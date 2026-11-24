import { Module, type DynamicModule, type Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Logger } from 'pino';

import { OidcIdentityProvider, type IdentityProvider } from '../identity/identity-provider.js';
import { createLogger } from '../logging/logger.js';
import { AuthService } from '../session/auth-service.js';
import { MemorySessionStore, PendingLoginStore, type SessionStore } from '../session/session-store.js';
import { AuthController, HealthController } from './controllers.js';
import { JwtServiceTokenVerifier, type ServiceTokenVerifier } from '../service/service-token.js';
import { CsrfGuard, PlatformThrottlerGuard, RolesGuard, ServiceGuard, SessionGuard } from './guards.js';
import type { PlatformModuleOptions } from './options.js';
import { AUDIT_LOGGER, PLATFORM_OPTIONS, SERVICE_TOKEN_VERIFIER } from './tokens.js';

const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');
const SESSION_STORE = Symbol('SESSION_STORE');

/**
 * Everything a system gets from the platform on the server: sign-in through the organization's
 * OIDC provider, server-side sessions, the access rule, CSRF protection, roles, rate limiting,
 * structured audit events and the health endpoint. Import it once, in the root module.
 */
@Module({})
export class PlatformModule {
  static forRoot(options: PlatformModuleOptions): DynamicModule {
    const { config } = options;
    const limits = {
      idleMs: config.SESSION_IDLE_MINUTES * 60_000,
      absoluteMs: config.SESSION_ABSOLUTE_HOURS * 3_600_000,
    };

    const providers: Provider[] = [
      { provide: PLATFORM_OPTIONS, useValue: options },
      { provide: AUDIT_LOGGER, useValue: createLogger({ level: config.LOG_LEVEL, system: options.system }) },
      {
        provide: IDENTITY_PROVIDER,
        useFactory: (): Promise<IdentityProvider> | IdentityProvider =>
          options.identityProvider ??
          OidcIdentityProvider.discover({
            issuer: config.OIDC_ISSUER,
            clientId: config.OIDC_CLIENT_ID,
            clientSecret: config.OIDC_CLIENT_SECRET,
            allowInsecureIssuer: config.OIDC_ALLOW_INSECURE_ISSUER,
          }),
      },
      {
        provide: SERVICE_TOKEN_VERIFIER,
        useFactory: (): ServiceTokenVerifier =>
          options.serviceTokenVerifier ??
          new JwtServiceTokenVerifier({
            issuer: config.OIDC_ISSUER,
            audience: config.OIDC_CLIENT_ID,
            allowInsecureIssuer: config.OIDC_ALLOW_INSECURE_ISSUER,
          }),
      },
      { provide: SESSION_STORE, useFactory: (): SessionStore => options.sessionStore ?? new MemorySessionStore(limits) },
      {
        provide: AuthService,
        inject: [IDENTITY_PROVIDER, SESSION_STORE, AUDIT_LOGGER],
        useFactory: (provider: IdentityProvider, sessions: SessionStore, logger: Logger) =>
          new AuthService({
            provider,
            sessions,
            pending: new PendingLoginStore(),
            access: options.access,
            ...(options.roles ? { roles: options.roles } : {}),
            ...(options.claimMapping ? { claimMapping: options.claimMapping } : {}),
            publicUrl: config.PUBLIC_URL.replace(/\/$/, ''),
            logger,
          }),
      },
      // Order matters: throttle, then load the session (or verify the calling system), then CSRF,
      // then roles.
      { provide: APP_GUARD, useClass: PlatformThrottlerGuard },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: ServiceGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ];

    return {
      module: PlatformModule,
      global: true,
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: options.requestsPerMinute ?? 300 }])],
      controllers: [AuthController, HealthController],
      providers,
      exports: [AuthService, AUDIT_LOGGER, PLATFORM_OPTIONS],
    };
  }
}
