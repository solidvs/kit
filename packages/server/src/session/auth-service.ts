import { decideAccess, resolveRoles, type AccessRule, type RoleRules } from '../access/access-rules.js';
import { newAuthorizationChecks, type IdentityProvider, type TokenSet } from '../identity/identity-provider.js';
import { DEFAULT_CLAIM_MAPPING, principalFromClaims, type ClaimMapping, type Principal } from '../identity/principal.js';
import { newSecret, type PendingLoginStore, type Session, type SessionStore } from './session-store.js';

/** Structured audit logger (pino-compatible). Events go to the structured log (control 11). */
export type AuditLogger = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
};

export type AuthServiceOptions = {
  readonly provider: IdentityProvider;
  readonly sessions: SessionStore;
  readonly pending: PendingLoginStore;
  readonly access: AccessRule;
  readonly roles?: RoleRules;
  readonly claimMapping?: ClaimMapping;
  /** Public origin of the system, without trailing slash. */
  readonly publicUrl: string;
  readonly logger: AuditLogger;
  /** Refresh this long before the access token expires. */
  readonly refreshLeewayMs?: number;
  readonly now?: () => number;
};

export type LoginResult =
  | { readonly kind: 'signed-in'; readonly session: Session; readonly returnTo: string }
  | { readonly kind: 'denied'; readonly principal: Principal }
  | { readonly kind: 'failed'; readonly reason: string };

/** Only relative paths of this origin are accepted as return targets (no open redirect). */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return '/';
  }
  return value;
}

/** Sign-in, session continuity and sign-out over an OIDC provider (ADR-0009). */
export class AuthService {
  private readonly now: () => number;
  private readonly roles: RoleRules;
  private readonly claimMapping: ClaimMapping;
  private readonly refreshLeewayMs: number;

  constructor(private readonly options: AuthServiceOptions) {
    this.now = options.now ?? Date.now;
    this.roles = options.roles ?? {};
    this.claimMapping = options.claimMapping ?? DEFAULT_CLAIM_MAPPING;
    this.refreshLeewayMs = options.refreshLeewayMs ?? 60_000;
  }

  get redirectUri(): string {
    return `${this.options.publicUrl}/api/auth/callback`;
  }

  /** Starts a sign-in: returns the pending-login id (for a cookie) and the provider URL. */
  async startLogin(returnTo: unknown): Promise<{ loginId: string; redirectUrl: URL }> {
    const checks = await newAuthorizationChecks();
    const loginId = this.options.pending.create({
      state: checks.state,
      nonce: checks.nonce,
      codeVerifier: checks.codeVerifier,
      returnTo: safeReturnTo(returnTo),
    });
    const redirectUrl = this.options.provider.authorizationUrl({
      state: checks.state,
      nonce: checks.nonce,
      codeChallenge: checks.codeChallenge,
      redirectUri: this.redirectUri,
    });
    return { loginId, redirectUrl };
  }

  /** Completes a sign-in. A session exists only for people the system's rule lets in. */
  async completeLogin(loginId: string | undefined, callbackUrl: URL): Promise<LoginResult> {
    const pending = loginId ? this.options.pending.take(loginId) : undefined;
    if (!pending) {
      this.options.logger.warn({ event: 'auth.login.failed', reason: 'no-pending-login' }, 'Sign-in callback without a pending sign-in');
      return { kind: 'failed', reason: 'no-pending-login' };
    }

    let tokens: TokenSet;
    let principal: Principal;
    try {
      tokens = await this.options.provider.exchangeCode(callbackUrl, pending);
      principal = principalFromClaims(tokens.claims, this.claimMapping);
    } catch (error) {
      this.options.logger.warn({ event: 'auth.login.failed', reason: (error as Error).name }, 'Sign-in rejected');
      return { kind: 'failed', reason: 'exchange-failed' };
    }

    const decision = decideAccess(principal, this.options.access);
    if (!decision.allowed) {
      this.options.logger.info(
        { event: 'auth.login.denied', subject: principal.subject, username: principal.username, department: principal.department },
        'Sign-in denied by the access rule',
      );
      return { kind: 'denied', principal };
    }

    const now = this.now();
    const session: Session = {
      id: newSecret(),
      principal,
      accessReason: decision.reason,
      roles: resolveRoles(principal, this.roles),
      csrfToken: newSecret(),
      ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
      ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
      accessTokenExpiresAt: tokens.expiresAt,
      createdAt: now,
      lastSeenAt: now,
    };
    await this.options.sessions.set(session);
    this.options.logger.info(
      { event: 'auth.login.success', subject: principal.subject, username: principal.username, accessBy: decision.reason.by, accessValue: decision.reason.value, roles: session.roles },
      'Signed in',
    );
    return { kind: 'signed-in', session, returnTo: pending.returnTo };
  }

  /**
   * Loads a session for a request. Refreshes it with the provider when the access token is about to
   * expire, which re-reads the directory: a disabled account, a revoked provider session or a lost
   * department or group ends or changes the session here.
   */
  async resume(sessionId: string | undefined): Promise<Session | undefined> {
    if (!sessionId) return undefined;
    const session = await this.options.sessions.get(sessionId);
    if (!session) return undefined;

    const now = this.now();
    let current: Session = { ...session, lastSeenAt: now };

    if (session.accessTokenExpiresAt - this.refreshLeewayMs <= now) {
      const refreshed = await this.refresh(current);
      if (!refreshed) {
        await this.options.sessions.delete(session.id);
        return undefined;
      }
      current = refreshed;
    }
    await this.options.sessions.set(current);
    return current;
  }

  /** Ends the session; returns where the browser goes to end the provider session too. */
  async logout(sessionId: string | undefined): Promise<string> {
    const session = sessionId ? await this.options.sessions.get(sessionId) : undefined;
    if (sessionId) await this.options.sessions.delete(sessionId);
    if (session) {
      this.options.logger.info({ event: 'auth.logout', subject: session.principal.subject, username: session.principal.username }, 'Signed out');
    }
    const endSession = this.options.provider.endSessionUrl({
      ...(session?.idToken ? { idToken: session.idToken } : {}),
      postLogoutRedirectUri: `${this.options.publicUrl}/`,
    });
    return endSession?.toString() ?? '/';
  }

  private async refresh(session: Session): Promise<Session | undefined> {
    const fields = { subject: session.principal.subject, username: session.principal.username };
    if (!session.refreshToken) {
      this.options.logger.info({ event: 'auth.session.ended', reason: 'no-refresh-token', ...fields }, 'Session ended');
      return undefined;
    }
    try {
      const tokens = await this.options.provider.refresh(session.refreshToken);
      const principal = principalFromClaims(tokens.claims, this.claimMapping);
      const decision = decideAccess(principal, this.options.access);
      if (!decision.allowed) {
        this.options.logger.info({ event: 'auth.session.ended', reason: 'access-lost', ...fields }, 'Session ended: access rule no longer met');
        return undefined;
      }
      return {
        ...session,
        principal,
        accessReason: decision.reason,
        roles: resolveRoles(principal, this.roles),
        ...(tokens.idToken ? { idToken: tokens.idToken } : {}),
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        accessTokenExpiresAt: tokens.expiresAt,
      };
    } catch (error) {
      this.options.logger.info({ event: 'auth.session.ended', reason: 'refresh-rejected', error: (error as Error).name, ...fields }, 'Session ended: provider refused refresh');
      return undefined;
    }
  }
}
