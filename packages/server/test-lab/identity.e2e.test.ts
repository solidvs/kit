/**
 * End-to-end check of ADR-0009 against a real Keycloak federated to an LDAP directory
 * (lab/identity). Run with `pnpm --filter @solidvs/server test:lab`; needs Docker.
 * Passwords and the client secret are generated for each run and exist only in a temp folder.
 */
import 'reflect-metadata';

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { stageKeycloak } from '../../../lab/keycloak.ts';
import { configurePlatformApp, CurrentService, platformConfigSchema, PlatformModule, ServiceRoute, type ServiceCaller } from '../src/index.js';

/** A route for other systems (ADR-0014): client credentials tokens issued for the portal. */
@Controller('feed')
class FeedController {
  @Get()
  @ServiceRoute()
  feed(@CurrentService() caller: ServiceCaller): { for: string } {
    return { for: caller.clientId };
  }
}

const LAB = join(dirname(fileURLToPath(import.meta.url)), '../../../lab/identity');
// LAB_KEYCLOAK_PORT: another port when a development laboratory already uses 8081.
const ISSUER = `http://localhost:${process.env.LAB_KEYCLOAK_PORT ?? '8081'}/realms/internal`;
const PUBLIC_URL = 'http://localhost:3999';
const secret = () => randomBytes(18).toString('base64url');
const passwords = { operator: secret(), bruno: secret(), ldapAdmin: secret(), keycloakAdmin: secret(), client: secret(), exampleClient: secret() };
// Under the home folder: the Docker VM (Colima) shares only the home folder with the host.
mkdirSync(join(homedir(), '.cache', 'platform-kit-lab'), { recursive: true });
const workdir = mkdtempSync(join(homedir(), '.cache', 'platform-kit-lab', 'identity-'));
const env = {
  ...process.env,
  LAB_WORKDIR: workdir,
  LAB_LDAP_ADMIN_PASSWORD: passwords.ldapAdmin,
  LAB_KEYCLOAK_ADMIN_PASSWORD: passwords.keycloakAdmin,
};

function compose(...args: string[]): string {
  return execFileSync('docker', ['compose', '-f', join(LAB, 'compose.yaml'), ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function render(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), readFileSync(join(LAB, template), 'utf8'));
}

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function cookieValue(response: request.Response, name: string): string | undefined {
  const header = response.headers['set-cookie'] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith(`${name}=`))?.split(';')[0];
}

/** Plays the browser on Keycloak's login page; returns the redirect back to the system. */
async function submitKeycloakLogin(authorizationUrl: string, username: string, password: string): Promise<Response> {
  const page = await fetch(authorizationUrl, { redirect: 'manual' });
  const cookies = page.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const html = await page.text();
  const action = /<form[^>]*id="kc-form-login"[^>]*>/.exec(html)?.[0].match(/action="([^"]+)"/)?.[1]?.replaceAll('&amp;', '&');
  if (!action) throw new Error('Keycloak login form not found');
  return fetch(action, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: cookies },
    body: new URLSearchParams({ username, password, credentialId: '' }),
  });
}

describe('ADR-0009 end to end: Keycloak federated to LDAP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    mkdirSync(join(workdir, 'ldif'));
    mkdirSync(join(workdir, 'realm'));
    writeFileSync(join(workdir, 'ldif', '50-directory.ldif'), render('directory.ldif.template', { OPERATOR_PASSWORD: passwords.operator, BRUNO_PASSWORD: passwords.bruno }));
    writeFileSync(join(workdir, 'realm', 'internal-realm.json'), render('realm.json.template', { CLIENT_SECRET: passwords.client, EXAMPLE_CLIENT_SECRET: passwords.exampleClient, LDAP_ADMIN_PASSWORD: passwords.ldapAdmin }));
    stageKeycloak(workdir);
    compose('up', '-d', '--wait-timeout', '180');
    await waitFor(`${ISSUER}/.well-known/openid-configuration`, 240_000);

    const config = platformConfigSchema.parse({
      PUBLIC_URL,
      OIDC_ISSUER: ISSUER,
      OIDC_CLIENT_ID: 'portal',
      OIDC_CLIENT_SECRET: passwords.client,
      OIDC_ALLOW_INSECURE_ISSUER: 'true',
      LOG_LEVEL: 'warn',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule.forRoot({ system: 'portal', config, access: { departments: ['TI'] }, roles: { admin: { groups: ['GRP-Portal-Admins'] } } })],
      controllers: [FeedController],
    }).compile();
    app = moduleRef.createNestApplication();
    configurePlatformApp(app);
    await app.init();
  }, 300_000);

  afterAll(async () => {
    await app?.close();
    compose('down', '-v');
    rmSync(workdir, { recursive: true, force: true });
  }, 120_000);

  async function signIn(username: string, password: string) {
    const login = await request(app.getHttpServer()).get('/api/auth/login?returnTo=/projetos');
    const keycloakAnswer = await submitKeycloakLogin(login.headers.location as string, username, password);
    const location = keycloakAnswer.headers.get('location');
    if (keycloakAnswer.status !== 302 || !location?.startsWith(`${PUBLIC_URL}/api/auth/callback`)) {
      return { keycloakStatus: keycloakAnswer.status, callback: undefined, session: undefined };
    }
    const callbackUrl = new URL(location);
    const callback = await request(app.getHttpServer())
      .get(`${callbackUrl.pathname}${callbackUrl.search}`)
      .set('Cookie', cookieValue(login, '__Host-login') ?? '');
    return { keycloakStatus: keycloakAnswer.status, callback, session: cookieValue(callback, '__Host-session') };
  }

  it('signs in a person of the IT department with the directory password; department and group arrive as claims', async () => {
    const { callback, session } = await signIn('operator', passwords.operator);
    expect(callback?.headers.location).toBe('/projetos');
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(200);
    expect(me.body).toMatchObject({
      user: { username: 'operator', name: 'Operador de TI', email: 'operator@example.test', department: 'TI' },
      access: { by: 'department', value: 'TI' },
      roles: ['admin'],
    });
  });

  it('refuses a person of another department, without a session', async () => {
    const { callback, session } = await signIn('bruno', passwords.bruno);
    expect(callback?.headers.location).toBe('/sem-acesso');
    expect(session).toBeUndefined();
  });

  it('keeps a wrong password at the provider: the system never sees it', async () => {
    const { keycloakStatus, callback } = await signIn('operator', 'wrong-password');
    expect(keycloakStatus).toBe(200);
    expect(callback).toBeUndefined();
  });

  it('refreshes with the provider and ends the provider session on logout', async () => {
    const { session } = await signIn('operator', passwords.operator);
    // Access tokens live 60 s in the lab and the session refreshes 60 s before expiry: every request refreshes.
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(200);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(200);
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', session!)
      .set('x-csrf-token', me.body.csrfToken as string)
      .expect(200);
    const endSession = new URL(logout.body.redirectUrl as string);
    expect(endSession.origin + endSession.pathname).toBe(`${ISSUER}/protocol/openid-connect/logout`);
    expect(endSession.searchParams.get('id_token_hint')).toBeTruthy();
    const providerLogout = await fetch(endSession, { redirect: 'manual' });
    expect(providerLogout.status).toBe(302);
    expect(providerLogout.headers.get('location')).toBe(`${PUBLIC_URL}/`);
  });

  it('ends the session at the next refresh when the person leaves the IT department in the directory', async () => {
    const { session } = await signIn('operator', passwords.operator);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(200);
    execFileSync(
      'docker',
      ['compose', '-f', join(LAB, 'compose.yaml'), 'exec', '-T', 'directory', 'ldapmodify', '-x', '-H', 'ldap://localhost', '-D', 'cn=admin,dc=example,dc=test', '-w', passwords.ldapAdmin],
      { env, input: 'dn: uid=operator,ou=people,dc=example,dc=test\nchangetype: modify\nreplace: departmentNumber\ndepartmentNumber: Vendas\n' },
    );
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', session!).expect(401);
  });

  it('lets another system call a service route with a client credentials token, never a person', async () => {
    const token = async (clientId: string, clientSecret: string) => {
      const response = await fetch(`${ISSUER}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
      });
      expect(response.status).toBe(200);
      return ((await response.json()) as { access_token: string }).access_token;
    };
    // The example system's client carries the portal as audience: accepted, and named.
    const example = await token('example', passwords.exampleClient);
    await request(app.getHttpServer()).get('/api/feed').set('Authorization', `Bearer ${example}`).expect(200, { for: 'example' });
    // A token whose audience is not the portal, a forged one, and a person's session: refused.
    const tampered = `${example.slice(0, -4)}AAAA`;
    await request(app.getHttpServer()).get('/api/feed').set('Authorization', `Bearer ${tampered}`).expect(401);
    await request(app.getHttpServer()).get('/api/feed').expect(401);
  });
});
