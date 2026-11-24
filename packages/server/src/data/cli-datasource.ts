import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { DatabaseConfig } from './database-config.js';
import { DEFAULT_PORTS, type DatabaseEngine } from './engine.js';

/**
 * The connection URL for the Prisma CLI (`prisma migrate deploy` and friends), built from the same
 * configuration keys as the running service. Used in `prisma.config.ts` of a system; never stored.
 *
 * The CLI's schema engine reads a trusted authority from a file, so `DATABASE_TLS_CA` is written
 * to a private temporary file (a tmpfs in the migration container). Certificates are always
 * verified: PostgreSQL with `sslaccept=strict`, SQL Server with `trustServerCertificate=false`.
 */
export function prismaCliUrl(engine: DatabaseEngine, config: DatabaseConfig): string {
  const port = config.DATABASE_PORT ?? DEFAULT_PORTS[engine];
  const caFile = config.DATABASE_TLS_CA ? writeCaFile(config.DATABASE_TLS_CA) : undefined;

  if (engine === 'postgresql') {
    const url = new URL(`postgresql://${config.DATABASE_HOST}:${port}/${config.DATABASE_NAME}`);
    url.username = encodeURIComponent(config.DATABASE_USER);
    url.password = encodeURIComponent(config.DATABASE_PASSWORD);
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
    if (caFile) url.searchParams.set('sslcert', caFile);
    return url.toString();
  }

  const parameters = [
    `database=${config.DATABASE_NAME}`,
    `user=${braced(config.DATABASE_USER)}`,
    `password=${braced(config.DATABASE_PASSWORD)}`,
    'encrypt=true',
    'trustServerCertificate=false',
    ...(caFile ? [`trustServerCertificateCA=${braced(caFile)}`] : []),
  ];
  return `sqlserver://${config.DATABASE_HOST}:${port};${parameters.join(';')}`;
}

/**
 * Free-form values of a SQL Server connection string go in braces, with `}` doubled: they may hold
 * `;`, `=` or spaces, and the CLI refuses an absolute path without them.
 */
function braced(value: string): string {
  return `{${value.replaceAll('}', '}}')}}`;
}

function writeCaFile(pem: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'database-ca-'));
  const file = join(dir, 'ca.pem');
  writeFileSync(file, pem, { mode: 0o600 });
  return file;
}
