import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/** The system calling a service route, as the identity provider vouches for it. */
export type ServiceCaller = {
  /** The caller's client id at the identity provider; by convention, its catalog id. */
  readonly clientId: string;
};

/** Verifies the bearer token of a system calling another (ADR-0014, item 5). */
export interface ServiceTokenVerifier {
  /** Resolves the caller, or rejects: never returns for an invalid token. */
  verify(token: string): Promise<ServiceCaller>;
}

export class InvalidServiceTokenError extends Error {}

export type JwtServiceTokenSettings = {
  /** Issuer of the organization's identity provider (OIDC_ISSUER). */
  readonly issuer: string;
  /** This system's client id: tokens must name it as their audience. */
  readonly audience: string;
  /** Laboratories only: accept an http issuer. */
  readonly allowInsecureIssuer?: boolean;
};

/**
 * Access tokens from the client credentials grant, issued by the organization's provider to
 * another system's client for this system: signature from the provider's published keys,
 * issuer, audience, expiry, and a client identity (`client_id` equal to `azp`). Tokens issued to
 * people are refused: service routes are for systems.
 */
export class JwtServiceTokenVerifier implements ServiceTokenVerifier {
  private keys: Promise<JWTVerifyGetKey> | undefined;

  constructor(private readonly settings: JwtServiceTokenSettings) {
    if (!settings.allowInsecureIssuer && new URL(settings.issuer).protocol !== 'https:') {
      throw new Error('OIDC issuer must use https');
    }
  }

  async verify(token: string): Promise<ServiceCaller> {
    try {
      const { payload } = await jwtVerify(token, await this.jwks(), {
        issuer: this.settings.issuer,
        audience: this.settings.audience,
        algorithms: ['RS256', 'PS256', 'ES256'],
        requiredClaims: ['exp', 'iat', 'azp', 'client_id'],
      });
      if (typeof payload.client_id !== 'string' || payload.client_id !== payload.azp) {
        throw new InvalidServiceTokenError('not a client credentials token');
      }
      return { clientId: payload.client_id };
    } catch (error) {
      if (error instanceof InvalidServiceTokenError) throw error;
      throw new InvalidServiceTokenError((error as Error).message);
    }
  }

  /** The provider's keys, found through its discovery document, fetched once and cached by jose. */
  private jwks(): Promise<JWTVerifyGetKey> {
    this.keys ??= (async () => {
      const response = await fetch(new URL(`${this.settings.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`));
      if (!response.ok) throw new Error(`discovery failed: ${response.status}`);
      const metadata = (await response.json()) as { issuer?: string; jwks_uri?: string };
      if (metadata.issuer !== this.settings.issuer || !metadata.jwks_uri) throw new Error('discovery document does not match the issuer');
      return createRemoteJWKSet(new URL(metadata.jwks_uri));
    })().catch((error: unknown) => {
      this.keys = undefined; // try again on the next request
      throw error;
    });
    return this.keys;
  }
}
