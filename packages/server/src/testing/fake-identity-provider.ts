import type { AuthorizationChecks, IdentityProvider, TokenSet } from '../identity/identity-provider.js';

/**
 * In-memory OIDC provider for tests. `authorizationUrl` returns the callback URL directly with a
 * code bound to the next person in `signInAs`, so a test can follow redirects without a browser.
 */
export class FakeIdentityProvider implements IdentityProvider {
  private readonly codes = new Map<string, { claims: Record<string, unknown>; state: string; nonce: string; challenge: string }>();
  private nextClaims: Record<string, unknown> = {};
  /** Claims returned by the next refresh; `null` makes refresh fail (revoked or disabled account). */
  refreshClaims: Record<string, unknown> | null = null;
  tokenLifetimeMs = 5 * 60_000;
  now: () => number = Date.now;

  signInAs(claims: Record<string, unknown>): void {
    this.nextClaims = claims;
  }

  authorizationUrl(params: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): URL {
    const code = `code-${this.codes.size + 1}`;
    this.codes.set(code, { claims: this.nextClaims, state: params.state, nonce: params.nonce, challenge: params.codeChallenge });
    const url = new URL(params.redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', params.state);
    return url;
  }

  async exchangeCode(callbackUrl: URL, checks: AuthorizationChecks): Promise<TokenSet> {
    const code = callbackUrl.searchParams.get('code') ?? '';
    const issued = this.codes.get(code);
    this.codes.delete(code);
    if (!issued) throw Object.assign(new Error('invalid_grant'), { name: 'ResponseBodyError' });
    if (callbackUrl.searchParams.get('state') !== checks.state || issued.state !== checks.state || issued.nonce !== checks.nonce) {
      throw Object.assign(new Error('state or nonce mismatch'), { name: 'ClientError' });
    }
    return this.tokens(issued.claims);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    if (this.refreshClaims === null || !refreshToken) {
      throw Object.assign(new Error('invalid_grant'), { name: 'ResponseBodyError' });
    }
    return this.tokens(this.refreshClaims);
  }

  endSessionUrl(params: { idToken?: string; postLogoutRedirectUri: string }): URL {
    const url = new URL('https://id.example.test/logout');
    url.searchParams.set('post_logout_redirect_uri', params.postLogoutRedirectUri);
    return url;
  }

  private tokens(claims: Record<string, unknown>): TokenSet {
    return { claims, idToken: 'id-token', refreshToken: 'refresh-token', expiresAt: this.now() + this.tokenLifetimeMs };
  }
}
