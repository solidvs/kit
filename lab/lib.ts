/**
 * Shared by `lab/lab.ts` (the laboratory for local development) and the laboratory tests of
 * `@solidvs/server`: compose, generated secrets, identity files and database provisioning.
 * Database pieces (TLS certificate, provisioning procedure) come from the server package, the
 * same code systems use through `solidvs-data lab`; build it first (`pnpm --filter
 * @solidvs/server build`). Runs on Node.js 24 without a build step of its own.
 */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stageKeycloak } from './keycloak.ts';

import {
  containerClients,
  labDatabaseKeys,
  labPassword,
  provisionDatabase,
  writeLabTls,
  type Credentials,
} from '../packages/server/dist/lab/database-lab.js';

export type Engine = 'postgresql' | 'sqlserver';
export type { Credentials };

export const LAB_DIR = dirname(fileURLToPath(import.meta.url));
export const COMPOSE_FILE = join(LAB_DIR, 'identity', 'compose.yaml');

/** Host ports of the laboratory's engines (compose.yaml). */
export const DATABASE_PORTS: Record<Engine, number> = { postgresql: 55432, sqlserver: 51433 };

export const secret = (): string => randomBytes(24).toString('base64url');
export const databasePassword = labPassword;

export function labEnv(workdir: string, values: { ldapAdmin: string; keycloakAdmin: string; databaseAdmin: string }): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LAB_WORKDIR: workdir,
    LAB_LDAP_ADMIN_PASSWORD: values.ldapAdmin,
    LAB_KEYCLOAK_ADMIN_PASSWORD: values.keycloakAdmin,
    LAB_DATABASE_ADMIN_PASSWORD: values.databaseAdmin,
  };
}

export function compose(env: NodeJS.ProcessEnv, ...args: string[]): string {
  return execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...args], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
}

function render(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), readFileSync(join(LAB_DIR, 'identity', template), 'utf8'));
}

type IdentityValues = 'OPERATOR_PASSWORD' | 'BRUNO_PASSWORD' | 'CLIENT_SECRET' | 'EXAMPLE_CLIENT_SECRET' | 'LDAP_ADMIN_PASSWORD'
  | 'CARLA_PASSWORD' | 'CARLA_OTP_SECRET' | 'PARTNER_CLIENT_SECRET';

/**
 * Directory entries and realms for Keycloak, with this run's secrets: `internal` (directory
 * accounts, ADR-0009) and `external` (local accounts with the second factor, ADR-0018). Also
 * copies the login theme and the extensions Keycloak mounts.
 */
export function writeIdentityFiles(workdir: string, values: Record<IdentityValues, string>): void {
  mkdirSync(join(workdir, 'ldif'), { recursive: true });
  mkdirSync(join(workdir, 'realm'), { recursive: true });
  writeFileSync(join(workdir, 'ldif', '50-directory.ldif'), render('directory.ldif.template', values));
  writeFileSync(join(workdir, 'realm', 'internal-realm.json'), render('realm.json.template', values));
  writeFileSync(join(workdir, 'realm', 'external-realm.json'), render('external-realm.json.template', values));
  stageKeycloak(workdir);
}

/** The laboratory certificate authority and server certificate, mounted by both engines. */
export const writeTls = (workdir: string): { ca: string } => ({ ca: writeLabTls(workdir).ca });

/**
 * Creates a system's database and logins with `database/provision.sh` of the server package,
 * the procedure administrators run on the real servers; only the client runs in the container.
 */
export function provision(env: NodeJS.ProcessEnv, engine: Engine, system: string, environment: string): Credentials {
  return provisionDatabase(engine, system, environment, {
    clients: containerClients(`docker compose -f ${COMPOSE_FILE} exec -T`, engine),
    adminPassword: env.LAB_DATABASE_ADMIN_PASSWORD!,
    env,
  });
}

/** The data module's configuration keys for one login of the laboratory. */
export const databaseKeys = (credentials: Credentials, login: 'application' | 'migration', ca: string): Record<string, string> =>
  labDatabaseKeys(credentials, login, ca, DATABASE_PORTS[credentials.engine]);
