import type { Request } from 'express';

import type { ServiceCaller } from '../service/service-token.js';
import type { Session } from '../session/session-store.js';

export const PLATFORM_OPTIONS = Symbol('PLATFORM_OPTIONS');
export const AUDIT_LOGGER = Symbol('AUDIT_LOGGER');
export const SERVICE_TOKEN_VERIFIER = Symbol('SERVICE_TOKEN_VERIFIER');

/** `__Host-` cookies: Secure, path `/`, no Domain — bound to this exact origin. */
export const SESSION_COOKIE = '__Host-session';
export const LOGIN_COOKIE = '__Host-login';
export const CSRF_HEADER = 'x-csrf-token';

export type PlatformRequest = Request & { platformSession?: Session; platformService?: ServiceCaller };
