import type { LoggerService } from '@nestjs/common';
import { pino, type Logger } from 'pino';

/** Values that must never reach a log line. */
const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'headers.cookie',
  'headers.authorization',
  '*.password',
  '*.secret',
  '*.token',
  '*.refreshToken',
  '*.idToken',
  '*.csrfToken',
  '*.OIDC_CLIENT_SECRET',
];

/** JSON logs on standard output, one event per line, rotated by the platform (Docker log driver). */
export function createLogger(options: { level: string; system: string }): Logger {
  return pino({
    level: options.level,
    base: { system: options.system },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACTED_PATHS, censor: '[redacted]' },
    formatters: { level: (label) => ({ level: label }) },
  });
}

/** Routes NestJS's own messages to the same structured log. */
export class PinoNestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, context?: string): void {
    this.logger.info({ context }, String(message));
  }
  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ context, trace }, String(message));
  }
  warn(message: unknown, context?: string): void {
    this.logger.warn({ context }, String(message));
  }
  debug(message: unknown, context?: string): void {
    this.logger.debug({ context }, String(message));
  }
  verbose(message: unknown, context?: string): void {
    this.logger.trace({ context }, String(message));
  }
}
