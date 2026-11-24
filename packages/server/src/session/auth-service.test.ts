import { describe, expect, it } from 'vitest';

import { FakeIdentityProvider } from '../testing/fake-identity-provider.js';
import { AuthService, safeReturnTo, type AuditLogger } from './auth-service.js';
import { MemorySessionStore, PendingLoginStore } from './session-store.js';

const MINUTE = 60_000;
const IT_PERSON = { sub: 's-1', preferred_username: 'ana', name: 'Ana', department: 'TI', groups: ['GRP-Portal-Admins'] };

function setup() {
  let now = Date.UTC(2026, 10, 23, 12);
  const clock = () => now;
  const events: Record<string, unknown>[] = [];
  const logger: AuditLogger = { info: (f) => events.push(f), warn: (f) => events.push(f) };
  const provider = new FakeIdentityProvider();
  provider.now = clock;
  const sessions = new MemorySessionStore({ idleMs: 30 * MINUTE, absoluteMs: 600 * MINUTE }, clock);
  const auth = new AuthService({
    provider,
    sessions,
    pending: new PendingLoginStore(10 * MINUTE, clock),
    access: { departments: ['TI'] },
    roles: { admin: { groups: ['GRP-Portal-Admins'] } },
    publicUrl: 'https://portal.example.com',
    logger,
    now: clock,
  });
  const signIn = async (claims: Record<string, unknown>, returnTo: unknown = '/projetos') => {
    provider.signInAs(claims);
    const { loginId, redirectUrl } = await auth.startLogin(returnTo);
    return auth.completeLogin(loginId, redirectUrl);
  };
  return { auth, provider, sessions, events, signIn, advance: (ms: number) => (now += ms) };
}

describe('safeReturnTo', () => {
  it('keeps relative paths and rejects anything that leaves the origin', () => {
    expect(safeReturnTo('/projetos/portal')).toBe('/projetos/portal');
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'projetos', 42, undefined]) {
      expect(safeReturnTo(bad)).toBe('/');
    }
  });
});

describe('AuthService', () => {
  it('signs in an IT person, with the reason and the group role', async () => {
    const { signIn, events } = setup();
    const result = await signIn(IT_PERSON);
    expect(result.kind).toBe('signed-in');
    if (result.kind !== 'signed-in') return;
    expect(result.returnTo).toBe('/projetos');
    expect(result.session.accessReason).toEqual({ by: 'department', value: 'TI' });
    expect(result.session.roles).toEqual(['admin']);
    expect(events.at(-1)).toMatchObject({ event: 'auth.login.success', username: 'ana' });
  });

  it('creates no session for someone outside the rule', async () => {
    const { signIn, sessions } = setup();
    const result = await signIn({ ...IT_PERSON, department: 'Vendas' });
    expect(result.kind).toBe('denied');
    expect(sessions.size).toBe(0);
  });

  it('accepts each pending sign-in once', async () => {
    const { auth, provider } = setup();
    provider.signInAs(IT_PERSON);
    const { loginId, redirectUrl } = await auth.startLogin('/');
    expect((await auth.completeLogin(loginId, redirectUrl)).kind).toBe('signed-in');
    expect((await auth.completeLogin(loginId, redirectUrl)).kind).toBe('failed');
  });

  it('rejects a callback from another browser (no pending sign-in)', async () => {
    const { auth, provider } = setup();
    provider.signInAs(IT_PERSON);
    const { redirectUrl } = await auth.startLogin('/');
    expect(await auth.completeLogin(undefined, redirectUrl)).toEqual({ kind: 'failed', reason: 'no-pending-login' });
  });

  it('rejects a tampered state', async () => {
    const { auth, provider } = setup();
    provider.signInAs(IT_PERSON);
    const { loginId, redirectUrl } = await auth.startLogin('/');
    redirectUrl.searchParams.set('state', 'forged');
    expect((await auth.completeLogin(loginId, redirectUrl)).kind).toBe('failed');
  });

  it('ends the session after 30 idle minutes', async () => {
    const { signIn, auth, advance } = setup();
    const result = await signIn(IT_PERSON);
    if (result.kind !== 'signed-in') throw new Error('expected sign-in');
    advance(31 * MINUTE);
    expect(await auth.resume(result.session.id)).toBeUndefined();
  });

  it('refreshes before the access token expires and follows directory changes', async () => {
    const { signIn, auth, provider, advance } = setup();
    const result = await signIn(IT_PERSON);
    if (result.kind !== 'signed-in') throw new Error('expected sign-in');
    provider.refreshClaims = { ...IT_PERSON, groups: [] };
    advance(4.5 * MINUTE);
    const resumed = await auth.resume(result.session.id);
    expect(resumed?.roles).toEqual([]);
  });

  it('ends the session when the person leaves the department', async () => {
    const { signIn, auth, provider, advance, events } = setup();
    const result = await signIn(IT_PERSON);
    if (result.kind !== 'signed-in') throw new Error('expected sign-in');
    provider.refreshClaims = { ...IT_PERSON, department: 'Vendas' };
    advance(4.5 * MINUTE);
    expect(await auth.resume(result.session.id)).toBeUndefined();
    expect(events.at(-1)).toMatchObject({ event: 'auth.session.ended', reason: 'access-lost' });
  });

  it('ends the session when the provider refuses the refresh (disabled account)', async () => {
    const { signIn, auth, provider, advance } = setup();
    const result = await signIn(IT_PERSON);
    if (result.kind !== 'signed-in') throw new Error('expected sign-in');
    provider.refreshClaims = null;
    advance(4.5 * MINUTE);
    expect(await auth.resume(result.session.id)).toBeUndefined();
  });

  it('logs out and points the browser at the provider logout', async () => {
    const { signIn, auth } = setup();
    const result = await signIn(IT_PERSON);
    if (result.kind !== 'signed-in') throw new Error('expected sign-in');
    const url = await auth.logout(result.session.id);
    expect(url).toContain('post_logout_redirect_uri=https%3A%2F%2Fportal.example.com%2F');
    expect(await auth.resume(result.session.id)).toBeUndefined();
  });
});
