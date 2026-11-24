/**
 * Database engines the platform supports and tests (ADR-0016). PostgreSQL is the reference engine;
 * SQL Server is supported for installations that already run it. An installation runs one engine,
 * chosen when the image is built.
 */
export const DATABASE_ENGINES = ['postgresql', 'sqlserver'] as const;

export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];

export const REFERENCE_ENGINE: DatabaseEngine = 'postgresql';

export const DEFAULT_PORTS: Record<DatabaseEngine, number> = { postgresql: 5432, sqlserver: 1433 };

export function isDatabaseEngine(value: string): value is DatabaseEngine {
  return (DATABASE_ENGINES as readonly string[]).includes(value);
}

/**
 * The engine this build was made for: the `DATABASE_ENGINE` environment variable, set by the image
 * (a build argument) or by the developer; PostgreSQL when absent. It is not a configuration key:
 * the generated client only works with the engine it was generated for.
 */
export function databaseEngine(env: NodeJS.ProcessEnv = process.env): DatabaseEngine {
  const value = env.DATABASE_ENGINE ?? REFERENCE_ENGINE;
  if (!isDatabaseEngine(value)) {
    throw new Error(`DATABASE_ENGINE must be one of ${DATABASE_ENGINES.join(', ')}`);
  }
  return value;
}
