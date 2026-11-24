import { Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AuthService } from '../session/auth-service.js';
import type { Session } from '../session/session-store.js';
import { CurrentSession, Public } from './decorators.js';
import type { PlatformModuleOptions } from './options.js';
import { LOGIN_COOKIE, PLATFORM_OPTIONS, SESSION_COOKIE, type PlatformRequest } from './tokens.js';

const BASE_COOKIE: CookieOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

/** What the browser may know about the session. Tokens never leave the server. */
export type MeResponse = {
  user: { username: string; name: string; email: string | null; department: string | null };
  roles: string[];
  access: { by: 'department' | 'group'; value: string };
  csrfToken: string;
};

export function meResponse(session: Session): MeResponse {
  const { principal } = session;
  return {
    user: {
      username: principal.username,
      name: principal.name,
      email: principal.email ?? null,
      department: principal.department ?? null,
    },
    roles: [...session.roles],
    access: { ...session.accessReason },
    csrfToken: session.csrfToken,
  };
}

@Controller('auth')
export class AuthController {
  private readonly publicUrl: string;
  private readonly deniedPath: string;
  private readonly absoluteMs: number;

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(PLATFORM_OPTIONS) options: PlatformModuleOptions,
  ) {
    this.publicUrl = options.config.PUBLIC_URL.replace(/\/$/, '');
    this.deniedPath = options.deniedPath ?? '/sem-acesso';
    this.absoluteMs = options.config.SESSION_ABSOLUTE_HOURS * 3_600_000;
  }

  /** Sends the browser to the identity provider. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('login')
  async login(@Query('returnTo') returnTo: unknown, @Res() res: Response): Promise<void> {
    const { loginId, redirectUrl } = await this.auth.startLogin(returnTo);
    res.cookie(LOGIN_COOKIE, loginId, { ...BASE_COOKIE, maxAge: 10 * 60_000 });
    res.redirect(302, redirectUrl.toString());
  }

  /** The provider's answer. Creates the session only if the system's access rule admits the person. */
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('callback')
  async callback(@Req() req: PlatformRequest, @Res() res: Response): Promise<void> {
    const loginId = (req.cookies as Record<string, string | undefined> | undefined)?.[LOGIN_COOKIE];
    const callbackUrl = new URL(req.originalUrl, this.publicUrl);
    const result = await this.auth.completeLogin(loginId, callbackUrl);
    res.clearCookie(LOGIN_COOKIE, BASE_COOKIE);

    switch (result.kind) {
      case 'signed-in':
        res.cookie(SESSION_COOKIE, result.session.id, { ...BASE_COOKIE, maxAge: this.absoluteMs });
        res.redirect(302, result.returnTo);
        return;
      case 'denied':
        res.redirect(302, this.deniedPath);
        return;
      case 'failed':
        res.redirect(302, '/?login=falhou');
        return;
    }
  }

  /** Who is signed in, why they may enter, their roles and the CSRF token. 401 without session. */
  @Get('me')
  me(@CurrentSession() session: Session): MeResponse {
    return meResponse(session);
  }

  /** Ends this system's session; the browser then follows `redirectUrl` to end the provider session. */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: PlatformRequest, @Res({ passthrough: true }) res: Response): Promise<{ redirectUrl: string }> {
    const redirectUrl = await this.auth.logout(req.platformSession?.id);
    res.clearCookie(SESSION_COOKIE, BASE_COOKIE);
    return { redirectUrl };
  }
}

@Controller('health')
export class HealthController {
  /** Liveness for the container healthcheck. Reveals nothing about the system. */
  @Public()
  @SkipThrottle()
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
