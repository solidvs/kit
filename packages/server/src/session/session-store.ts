import { randomBytes } from 'node:crypto';

import type { AccessReason } from '../access/access-rules.js';
import type { Principal } from '../identity/principal.js';

export type Session = {
  readonly id: string;
  readonly principal: Principal;
  readonly accessReason: AccessReason;
  readonly roles: readonly string[];
  /** Sent back by the browser in `x-csrf-token` on every state-changing request. */
  readonly csrfToken: string;
  readonly idToken?: string;
  readonly refreshToken?: string;
  readonly accessTokenExpiresAt: number;
  readonly createdAt: number;
  readonly lastSeenAt: number;
};

/** Server-side session storage. Version 1 keeps sessions in memory; a SQL store comes with the first database. */
export interface SessionStore {
  get(id: string): Promise<Session | undefined>;
  set(session: Session): Promise<void>;
  delete(id: string): Promise<void>;
}

export type SessionLimits = {
  readonly idleMs: number;
  readonly absoluteMs: number;
};

/** 256-bit random identifier, URL-safe. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function isExpired(session: Session, limits: SessionLimits, now: number): boolean {
  return now - session.lastSeenAt > limits.idleMs || now - session.createdAt > limits.absoluteMs;
}

/**
 * Sessions in process memory, with idle and absolute expiry. A restart signs everyone out of this
 * system only: the provider's single sign-on session brings them back without a password prompt.
 */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(
    private readonly limits: SessionLimits,
    private readonly now: () => number = Date.now,
  ) {
    this.sweeper = setInterval(() => this.sweep(), 60_000);
    this.sweeper.unref();
  }

  async get(id: string): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    if (isExpired(session, this.limits, this.now())) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  /** Number of live sessions, for tests and health information. */
  get size(): number {
    return this.sessions.size;
  }

  close(): void {
    clearInterval(this.sweeper);
  }

  private sweep(): void {
    const now = this.now();
    for (const [id, session] of this.sessions) {
      if (isExpired(session, this.limits, now)) this.sessions.delete(id);
    }
  }
}

/** One sign-in in progress: what the callback must find to accept the provider's answer. */
export type PendingLogin = {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
  /** Relative path to return to after sign-in. */
  readonly returnTo: string;
  readonly expiresAt: number;
};

/** Pending sign-ins, keyed by a random id held in a short-lived cookie of the same browser. */
export class PendingLoginStore {
  private readonly pending = new Map<string, PendingLogin>();

  constructor(
    private readonly ttlMs = 10 * 60_000,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 10_000,
  ) {}

  create(login: Omit<PendingLogin, 'expiresAt'>): string {
    this.evictExpired();
    if (this.pending.size >= this.maxEntries) {
      const oldest = this.pending.keys().next().value;
      if (oldest !== undefined) this.pending.delete(oldest);
    }
    const id = newSecret();
    this.pending.set(id, { ...login, expiresAt: this.now() + this.ttlMs });
    return id;
  }

  /** Returns and removes the pending sign-in: each one can be completed once. */
  take(id: string): PendingLogin | undefined {
    const login = this.pending.get(id);
    this.pending.delete(id);
    if (!login || login.expiresAt < this.now()) return undefined;
    return login;
  }

  private evictExpired(): void {
    const now = this.now();
    for (const [id, login] of this.pending) {
      if (login.expiresAt < now) this.pending.delete(id);
    }
  }
}
