import { timingSafeEqual } from 'node:crypto';

import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Response } from 'express';

import type { ServiceTokenVerifier } from '../service/service-token.js';
import { AuthService, type AuditLogger } from '../session/auth-service.js';
import { IS_PUBLIC, REQUIRED_ROLES, SERVICE_ROUTE } from './decorators.js';
import type { PlatformModuleOptions } from './options.js';
import { AUDIT_LOGGER, CSRF_HEADER, PLATFORM_OPTIONS, SERVICE_TOKEN_VERIFIER, SESSION_COOKIE, type PlatformRequest } from './tokens.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isPublic(reflector: Reflector, context: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]) === true;
}

function isServiceRoute(reflector: Reflector, context: ExecutionContext): boolean {
  return reflector.getAllAndOverride<boolean>(SERVICE_ROUTE, [context.getHandler(), context.getClass()]) === true;
}

/** Rate limit per client. Behind the Cloudflare tunnel the client address is in CF-Connecting-IP. */
@Injectable()
export class PlatformThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const headers = req.headers as Record<string, string | undefined>;
    return headers['cf-connecting-ip'] ?? (req.ip as string | undefined) ?? 'unknown';
  }
}

/** Loads (and refreshes) the session on every request; requires it unless the route is public. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AuthService) private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Service routes are for systems; a person's session plays no part in them (ServiceGuard).
    if (isServiceRoute(this.reflector, context)) return true;
    const http = context.switchToHttp();
    const request = http.getRequest<PlatformRequest>();
    const cookie = (request.cookies as Record<string, string | undefined> | undefined)?.[SESSION_COOKIE];
    const session = await this.auth.resume(cookie);
    if (session) {
      request.platformSession = session;
    } else if (cookie) {
      http.getResponse<Response>().clearCookie(SESSION_COOKIE, { path: '/', secure: true, httpOnly: true, sameSite: 'lax' });
    }
    if (session || isPublic(this.reflector, context)) return true;
    throw new UnauthorizedException();
  }
}

/** Enforces `@ServiceRoute`: a valid bearer token of another system's client, or 401. */
@Injectable()
export class ServiceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SERVICE_TOKEN_VERIFIER) private readonly verifier: ServiceTokenVerifier,
    @Inject(AUDIT_LOGGER) private readonly logger: AuditLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isServiceRoute(this.reflector, context)) return true;
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    try {
      request.platformService = await this.verifier.verify(match[1]!);
      return true;
    } catch (error) {
      // The reason, never the token.
      this.logger.warn({ event: 'service.denied', path: request.path, reason: (error as Error).message }, 'service token refused');
      throw new UnauthorizedException();
    }
  }
}

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * State-changing requests must come from this origin and carry the session's CSRF token in a
 * header, which a cross-site form or image cannot set (ASVS 5.0, V3).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly origin: string;

  constructor(@Inject(PLATFORM_OPTIONS) options: PlatformModuleOptions) {
    this.origin = new URL(options.config.PUBLIC_URL).origin;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<PlatformRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin !== undefined && origin !== this.origin) throw new ForbiddenException('Origin not allowed');

    const session = request.platformSession;
    const token = request.headers[CSRF_HEADER];
    if (!session || typeof token !== 'string' || !sameSecret(token, session.csrfToken)) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }
    return true;
  }
}

/** Enforces `@RequireRoles`. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const session = context.switchToHttp().getRequest<PlatformRequest>().platformSession;
    if (session && required.some((role) => session.roles.includes(role))) return true;
    throw new ForbiddenException('Role required');
  }
}
