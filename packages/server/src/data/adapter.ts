import type { SqlDriverAdapterFactory } from '@prisma/driver-adapter-utils';

import type { DatabaseConfig } from './database-config.js';
import { DEFAULT_PORTS, type DatabaseEngine } from './engine.js';

/**
 * The Prisma driver adapter for the engine, built from the configuration. TLS is always on and the
 * server certificate is always verified, against the system's trust store plus `DATABASE_TLS_CA`
 * when given (control 8). Only the engine's driver is loaded.
 */
export async function createDriverAdapter(engine: DatabaseEngine, config: DatabaseConfig): Promise<SqlDriverAdapterFactory> {
  const port = config.DATABASE_PORT ?? DEFAULT_PORTS[engine];
  const ca = config.DATABASE_TLS_CA ? [config.DATABASE_TLS_CA] : undefined;

  if (engine === 'postgresql') {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    return new PrismaPg({
      host: config.DATABASE_HOST,
      port,
      database: config.DATABASE_NAME,
      user: config.DATABASE_USER,
      password: config.DATABASE_PASSWORD,
      max: config.DATABASE_POOL_MAX,
      ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    });
  }

  const { PrismaMssql } = await import('@prisma/adapter-mssql');
  return new PrismaMssql({
    server: config.DATABASE_HOST,
    port,
    database: config.DATABASE_NAME,
    user: config.DATABASE_USER,
    password: config.DATABASE_PASSWORD,
    pool: { max: config.DATABASE_POOL_MAX, min: 0 },
    options: {
      encrypt: true,
      trustServerCertificate: false,
      ...(ca ? { cryptoCredentialsDetails: { ca } } : {}),
    },
  });
}
