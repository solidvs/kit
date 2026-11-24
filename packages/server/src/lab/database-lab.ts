/**
 * A database engine of the laboratory, for development and CI (ADR-0016): a container with TLS
 * from a laboratory authority, provisioned by the same procedure administrators run on the real
 * servers (`database/provision.sh`, shipped in this package). Used by `solidvs-data lab` in
 * systems and by the platform kit's own laboratory. Never for staging or production.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DatabaseEngine } from '../data/engine.js';

/** `database/provision.sh` of this package. */
export const PROVISION_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'database', 'provision.sh');

/** Images of the laboratory's engines, pinned by digest (same as lab/identity/compose.yaml). */
export const LAB_IMAGES: Record<DatabaseEngine, string> = {
  postgresql: 'postgres:18.6-alpine3.24@sha256:9ba53c7d41ea093baf5c1ba635ba5434c4f979880527d49bb7d9237d3193085b',
  sqlserver: 'mcr.microsoft.com/mssql/server:2022-CU28-ubuntu-22.04@sha256:4525e3efac9f3e241cb003bb2ff2a82818b502f37e12049d788b1a9fa7e13b7f',
};

export type Credentials = {
  engine: DatabaseEngine;
  database: string;
  application: { user: string; password: string };
  migration: { user: string; password: string };
};

/** Strong enough for SQL Server's password policy: upper case, lower case and digits. */
export const labPassword = (): string => `Lab${randomBytes(24).toString('base64url').replace(/[-_]/g, 'x')}9`;

/**
 * A certificate authority for the laboratory and a server certificate for `localhost`. Clients
 * trust the authority (DATABASE_TLS_CA) and verify the server like any other.
 */
export function writeLabTls(workdir: string): { ca: string; dir: string } {
  const dir = join(workdir, 'tls');
  mkdirSync(dir, { recursive: true });
  const openssl = (...args: string[]) => execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  writeFileSync(join(dir, 'ca.cnf'), [
    '[req]', 'distinguished_name = dn', 'x509_extensions = ca', 'prompt = no',
    '[dn]', 'CN = Platform laboratory CA',
    '[ca]', 'basicConstraints = critical, CA:TRUE', 'keyUsage = critical, keyCertSign, cRLSign', 'subjectKeyIdentifier = hash',
  ].join('\n'));
  writeFileSync(join(dir, 'server.cnf'), [
    'subjectAltName = DNS:localhost, IP:127.0.0.1', 'basicConstraints = critical, CA:FALSE',
    'keyUsage = critical, digitalSignature, keyEncipherment', 'extendedKeyUsage = serverAuth',
  ].join('\n'));
  openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '30', '-config', 'ca.cnf');
  openssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=localhost');
  openssl('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '30', '-extfile', 'server.cnf');
  // SQL Server runs as its own user and must read the key; the folder itself is private.
  chmodSync(join(dir, 'server.key'), 0o644);
  writeFileSync(join(dir, 'mssql.conf'), [
    '[network]', 'tlscert = /var/opt/mssql/tls/server.crt', 'tlskey = /var/opt/mssql/tls/server.key',
    'tlsprotocols = 1.2', 'forceencryption = 1', '',
  ].join('\n'));
  return { ca: readFileSync(join(dir, 'ca.crt'), 'utf8'), dir };
}

/**
 * Client commands of an engine running in a container: `exec` is `docker exec -i` or
 * `docker compose … exec -T`, `target` the container or service. Values reach the client through
 * environment variables, never through arguments.
 */
export function containerClients(exec: string, target: string): { PSQL: string; SQLCMD: string } {
  const pass = '-e SYSTEM -e ENVIRONMENT -e APP_PASSWORD -e MIGRATION_PASSWORD';
  return {
    PSQL: `${exec} ${pass} ${target} psql -U postgres`,
    SQLCMD: `${exec} ${pass} -e SQLCMDPASSWORD ${target} /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa`,
  };
}

/** Runs the provisioning procedure; `clients` set PSQL or SQLCMD (see `database/provision.sh`). */
export function provisionDatabase(
  engine: DatabaseEngine,
  system: string,
  environment: string,
  options: { clients: { PSQL: string; SQLCMD: string }; adminPassword: string; env?: NodeJS.ProcessEnv },
): Credentials {
  const output = execFileSync('sh', [PROVISION_SCRIPT, engine, system, environment], {
    env: { ...(options.env ?? process.env), ...options.clients, SQLCMDPASSWORD: options.adminPassword },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(output) as Credentials;
}

/** The data module's configuration keys for one login of a laboratory database. */
export function labDatabaseKeys(credentials: Credentials, login: 'application' | 'migration', ca: string, port: number): Record<string, string> {
  return {
    DATABASE_HOST: 'localhost',
    DATABASE_PORT: String(port),
    DATABASE_NAME: credentials.database,
    DATABASE_USER: credentials[login].user,
    DATABASE_PASSWORD: credentials[login].password,
    DATABASE_TLS_CA: ca,
  };
}

const docker = (args: string[], env?: NodeJS.ProcessEnv) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...(env ? { env } : {}) }).trim();

/**
 * Starts one engine as a standalone container named `<name>`, published on 127.0.0.1:<port>, and
 * waits until it answers. Provision it with `containerClients('docker exec -i', name)`.
 */
export function startDatabaseContainer(engine: DatabaseEngine, options: { name: string; port: number; workdir: string; adminPassword: string }): void {
  const tls = join(options.workdir, 'tls');
  const common = ['run', '-d', '--name', options.name, '-p', `127.0.0.1:${options.port}:${engine === 'postgresql' ? 5432 : 1433}`];
  if (engine === 'postgresql') {
    docker([
      ...common, '--env', 'POSTGRES_PASSWORD', '-v', `${tls}:/lab-tls:ro`, '--entrypoint', 'sh', LAB_IMAGES.postgresql, '-c',
      'install -o postgres -g postgres -m 0600 /lab-tls/server.key /var/lib/postgresql/server.key && ' +
        'install -o postgres -g postgres -m 0644 /lab-tls/server.crt /var/lib/postgresql/server.crt && ' +
        'exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/var/lib/postgresql/server.crt ' +
        '-c ssl_key_file=/var/lib/postgresql/server.key -c ssl_min_protocol_version=TLSv1.2',
    ], { ...process.env, POSTGRES_PASSWORD: options.adminPassword });
  } else {
    if (process.env.LAB_MSSQL_ACCEPT_EULA !== 'Y') {
      throw new Error('SQL Server Developer edition: set LAB_MSSQL_ACCEPT_EULA=Y to accept its licence (development and tests only)');
    }
    docker([
      ...common, '--platform', 'linux/amd64', '--env', 'ACCEPT_EULA=Y', '--env', 'MSSQL_PID=Developer', '--env', 'MSSQL_SA_PASSWORD',
      '-v', `${tls}:/var/opt/mssql/tls:ro`, '-v', `${join(tls, 'mssql.conf')}:/var/opt/mssql/mssql.conf:ro`, LAB_IMAGES.sqlserver,
    ], { ...process.env, MSSQL_SA_PASSWORD: options.adminPassword });
  }
  const probe = engine === 'postgresql'
    ? ['exec', options.name, 'pg_isready', '-h', 'localhost', '-U', 'postgres']
    : ['exec', '-e', 'SQLCMDPASSWORD', options.name, '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', 'sa', '-b', '-Q', 'SELECT 1'];
  const deadline = Date.now() + 600_000;
  for (;;) {
    try {
      execFileSync('docker', probe, { stdio: 'ignore', env: { ...process.env, SQLCMDPASSWORD: options.adminPassword } });
      return;
    } catch {
      if (Date.now() > deadline) throw new Error(`${engine} did not start; see \`docker logs ${options.name}\``);
      execFileSync('sleep', ['2']);
    }
  }
}

export function removeDatabaseContainer(name: string): void {
  try {
    docker(['rm', '-f', '-v', name]);
  } catch {
    // already gone
  }
}
