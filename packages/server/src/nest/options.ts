import type { AccessRule, RoleRules } from '../access/access-rules.js';
import type { PlatformConfig } from '../config/load-config.js';
import type { IdentityProvider } from '../identity/identity-provider.js';
import type { ClaimMapping } from '../identity/principal.js';
import type { ServiceTokenVerifier } from '../service/service-token.js';
import type { SessionStore } from '../session/session-store.js';

export type PlatformModuleOptions = {
  /** System id, as in the catalog and the platform repository (e.g. `portal`). */
  readonly system: string;
  readonly config: PlatformConfig;
  /** Who may enter the system (ADR-0009). */
  readonly access: AccessRule;
  /** Roles inside the system, from directory groups. */
  readonly roles?: RoleRules;
  readonly claimMapping?: ClaimMapping;
  /** Where the browser goes when the access rule refuses the person. Default `/sem-acesso`. */
  readonly deniedPath?: string;
  /** Requests per minute per client; sign-in endpoints get a fifth of it. Default 300. */
  readonly requestsPerMinute?: number;
  /** Test seams: a fake provider, a custom session store and a fake verifier of service tokens. */
  readonly identityProvider?: IdentityProvider;
  readonly sessionStore?: SessionStore;
  readonly serviceTokenVerifier?: ServiceTokenVerifier;
};
