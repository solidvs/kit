import { readFileSync } from 'node:fs';
import { z } from 'zod';

/** Where the platform delivers a system's variables and secrets (ADR-0007): one JSON file. */
export const DEFAULT_CONFIG_PATH = '/run/secrets/config';

/** Raised when the configuration file is missing, unreadable or incomplete. Never carries values. */
export class ConfigError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

/** Settings every system needs from the platform. Systems extend this schema with their own keys. */
export const platformConfigSchema = z.object({
  /** Public origin of the system, e.g. https://portal.example.com. */
  PUBLIC_URL: z.url(),
  /** OpenID Connect issuer, e.g. https://id.example.com/realms/internal. */
  OIDC_ISSUER: z.url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(1),
  /** Allows an http issuer. Only for local development and laboratories, never in production. */
  OIDC_ALLOW_INSECURE_ISSUER: z.stringbool().default(false),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(30),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().positive().default(10),
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

type LoadOptions = {
  /** Defaults to the CONFIG_FILE environment variable, then to /run/secrets/config. */
  path?: string;
  env?: NodeJS.ProcessEnv;
};

/**
 * Reads the configuration file and validates it against the system's schema. The system refuses to
 * start when anything is missing: error messages name the keys, never the values.
 */
export function loadConfig<S extends z.ZodType>(schema: S, options: LoadOptions = {}): z.infer<S> {
  const env = options.env ?? process.env;
  const path = options.path ?? env.CONFIG_FILE ?? DEFAULT_CONFIG_PATH;

  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    throw new ConfigError([`cannot read ${path}: ${(error as NodeJS.ErrnoException).code ?? 'unknown error'}`]);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ConfigError([`${path} is not valid JSON`]);
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ConfigError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
    );
  }
  return result.data;
}
