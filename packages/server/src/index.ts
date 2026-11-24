export {
  decideAccess,
  normalizeName,
  resolveRoles,
  type AccessDecision,
  type AccessReason,
  type AccessRule,
  type RoleRules,
} from './access/access-rules.js';
export {
  ConfigError,
  DEFAULT_CONFIG_PATH,
  loadConfig,
  platformConfigSchema,
  type PlatformConfig,
} from './config/load-config.js';
export {
  OidcIdentityProvider,
  type AuthorizationChecks,
  type IdentityProvider,
  type OidcSettings,
  type TokenSet,
} from './identity/identity-provider.js';
export {
  DEFAULT_CLAIM_MAPPING,
  InvalidClaimsError,
  principalFromClaims,
  type ClaimMapping,
  type Principal,
} from './identity/principal.js';
export { createLogger, PinoNestLogger } from './logging/logger.js';
export { configurePlatformApp } from './nest/configure-app.js';
export { meResponse, type MeResponse } from './nest/controllers.js';
export { CurrentService, CurrentSession, Public, RequireRoles, ServiceRoute } from './nest/decorators.js';
export type { PlatformModuleOptions } from './nest/options.js';
export { PlatformModule } from './nest/platform.module.js';
export { AUDIT_LOGGER, CSRF_HEADER, SESSION_COOKIE } from './nest/tokens.js';
export { AuthService, safeReturnTo, type AuditLogger, type LoginResult } from './session/auth-service.js';
export {
  MemorySessionStore,
  type Session,
  type SessionLimits,
  type SessionStore,
} from './session/session-store.js';
export * from './data/index.js';
export { DATABASE_CLIENT, DataModule, type DataModuleOptions } from './data/data.module.js';
export {
  InvalidServiceTokenError,
  JwtServiceTokenVerifier,
  type JwtServiceTokenSettings,
  type ServiceCaller,
  type ServiceTokenVerifier,
} from './service/service-token.js';
export * from './definitions/kinds.js';
