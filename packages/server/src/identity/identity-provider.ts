import * as oidc from 'openid-client';

/** Tokens and claims kept server-side after a successful sign-in or refresh. Never sent to the browser. */
export type TokenSet = {
  readonly claims: Readonly<Record<string, unknown>>;
  readonly idToken?: string;
  readonly refreshToken?: string;
  /** Epoch milliseconds when the access token expires; the session refreshes before it. */
  readonly expiresAt: number;
};

export type AuthorizationChecks = {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
};

/** The OpenID Connect provider as the platform uses it. Implemented by `OidcIdentityProvider`. */
export interface IdentityProvider {
  authorizationUrl(params: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): URL;
  /** Exchanges the authorization code; validates state, nonce, PKCE and the ID token. */
  exchangeCode(callbackUrl: URL, checks: AuthorizationChecks): Promise<TokenSet>;
  /** Fails when the session was revoked or the directory account is disabled. */
  refresh(refreshToken: string): Promise<TokenSet>;
  endSessionUrl(params: { idToken?: string; postLogoutRedirectUri: string }): URL | undefined;
}

export type OidcSettings = {
  readonly issuer: string;
  readonly clientId: string;
  readonly clientSecret: string;
  /** Laboratories only: accept an http issuer. */
  readonly allowInsecureIssuer?: boolean;
};

/** PKCE, state and nonce for one sign-in attempt. */
export async function newAuthorizationChecks(): Promise<AuthorizationChecks & { codeChallenge: string }> {
  const codeVerifier = oidc.randomPKCECodeVerifier();
  return {
    state: oidc.randomState(),
    nonce: oidc.randomNonce(),
    codeVerifier,
    codeChallenge: await oidc.calculatePKCECodeChallenge(codeVerifier),
  };
}

type TokenResponse = Pick<oidc.TokenEndpointResponseHelpers, 'claims' | 'expiresIn'> & {
  readonly id_token?: string;
  readonly refresh_token?: string;
};

function toTokenSet(response: TokenResponse): TokenSet {
  const claims = response.claims();
  if (!claims) throw new Error('Token response without ID token claims');
  return {
    claims: claims as Readonly<Record<string, unknown>>,
    ...(response.id_token ? { idToken: response.id_token } : {}),
    ...(response.refresh_token ? { refreshToken: response.refresh_token } : {}),
    expiresAt: Date.now() + (response.expiresIn() ?? 300) * 1000,
  };
}

/** Confidential client of a standard OIDC provider (Keycloak, Entra ID, …), discovered from its issuer. */
export class OidcIdentityProvider implements IdentityProvider {
  private constructor(private readonly configuration: oidc.Configuration) {}

  static async discover(settings: OidcSettings): Promise<OidcIdentityProvider> {
    const insecure = settings.allowInsecureIssuer === true;
    if (!insecure && new URL(settings.issuer).protocol !== 'https:') {
      throw new Error('OIDC issuer must use https');
    }
    const configuration = await oidc.discovery(
      new URL(settings.issuer),
      settings.clientId,
      settings.clientSecret,
      undefined,
      insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
    );
    return new OidcIdentityProvider(configuration);
  }

  authorizationUrl(params: { state: string; nonce: string; codeChallenge: string; redirectUri: string }): URL {
    return oidc.buildAuthorizationUrl(this.configuration, {
      redirect_uri: params.redirectUri,
      scope: 'openid profile email',
      response_type: 'code',
      state: params.state,
      nonce: params.nonce,
      code_challenge: params.codeChallenge,
      code_challenge_method: 'S256',
    });
  }

  async exchangeCode(callbackUrl: URL, checks: AuthorizationChecks): Promise<TokenSet> {
    const response = await oidc.authorizationCodeGrant(this.configuration, callbackUrl, {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
    return toTokenSet(response);
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    return toTokenSet(await oidc.refreshTokenGrant(this.configuration, refreshToken));
  }

  endSessionUrl(params: { idToken?: string; postLogoutRedirectUri: string }): URL | undefined {
    if (!this.configuration.serverMetadata().end_session_endpoint) return undefined;
    return oidc.buildEndSessionUrl(this.configuration, {
      post_logout_redirect_uri: params.postLogoutRedirectUri,
      ...(params.idToken ? { id_token_hint: params.idToken } : {}),
    });
  }
}
