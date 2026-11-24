import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';

import type { ServiceCaller } from '../service/service-token.js';
import type { Session } from '../session/session-store.js';
import type { PlatformRequest } from './tokens.js';

export const IS_PUBLIC = 'platform:public';
export const REQUIRED_ROLES = 'platform:roles';
export const SERVICE_ROUTE = 'platform:service';

/** Route reachable without a session (sign-in endpoints, health). Everything else requires one. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Route reserved to holders of at least one of these roles (granted by directory groups). */
export const RequireRoles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_ROLES, roles);

/** The current session, guaranteed present on non-public routes. */
export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext): Session | undefined => {
  return context.switchToHttp().getRequest<PlatformRequest>().platformSession;
});

/**
 * Route for other systems, not for people (ADR-0014): no session; a bearer access token from the
 * client credentials grant, issued by the organization's provider for this system, is required.
 */
export const ServiceRoute = (): MethodDecorator & ClassDecorator => SetMetadata(SERVICE_ROUTE, true);

/** The calling system, guaranteed present on service routes. */
export const CurrentService = createParamDecorator((_data: unknown, context: ExecutionContext): ServiceCaller | undefined => {
  return context.switchToHttp().getRequest<PlatformRequest>().platformService;
});
