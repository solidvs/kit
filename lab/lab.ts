/**
 * The laboratory for local development: identity provider, directory and one database engine,
 * with generated secrets. A system created from the template runs against it.
 *
 *   node lab/lab.ts up [--engine postgresql|sqlserver]     start (PostgreSQL by default)
 *   node lab/lab.ts database <system> <environment>         create a database and its two logins
 *   node lab/lab.ts config <system> <environment> --out <file> [--migration]
 *                                                           write a system's configuration file
 *   node lab/lab.ts password <ana|bruno>                    directory password of a test person
 *   node lab/lab.ts down                                    stop and delete everything
 *
 * SQL Server: set LAB_MSSQL_ACCEPT_EULA=Y to accept the Developer edition licence; on Apple
 * silicon, Docker needs Rosetta emulation and at least 4 GB (see README).
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { compose, databaseKeys, databasePassword, labEnv, provision, secret, writeIdentityFiles, writeTls, type Credentials, type Engine } from './lib.ts';

const WORKDIR = join(homedir(), '.cache', 'platform-kit-lab', 'dev');
const STATE = join(WORKDIR, 'state.json');

type State = {
  engine: Engine;
  passwords: { ana: string; bruno: string; ldapAdmin: string; keycloakAdmin: string; databaseAdmin: string };
  clientSecrets: Record<'portal' | 'example', string>;
  ca: string;
  databases: Record<string, Credentials>;
};

class Failure extends Error {}

function load(): State {
  if (!existsSync(STATE)) throw new Failure('the laboratory is not running; start it with `node lab/lab.ts up`');
  return JSON.parse(readFileSync(STATE, 'utf8')) as State;
}

function save(state: State): void {
  writeFileSync(STATE, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

const envOf = (state: State) => labEnv(WORKDIR, state.passwords);
const option = (args: string[], name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

function up(args: string[]): void {
  const engine = (option(args, '--engine') ?? 'postgresql') as Engine;
  if (!['postgresql', 'sqlserver'].includes(engine)) throw new Failure('--engine is postgresql or sqlserver');
  if (engine === 'sqlserver' && process.env.LAB_MSSQL_ACCEPT_EULA !== 'Y') {
    throw new Failure('SQL Server Developer edition: set LAB_MSSQL_ACCEPT_EULA=Y to accept its licence (development and tests only)');
  }
  if (existsSync(STATE)) throw new Failure('the laboratory is already running; `node lab/lab.ts down` first');
  mkdirSync(WORKDIR, { recursive: true, mode: 0o700 });
  chmodSync(WORKDIR, 0o700);
  const state: State = {
    engine,
    passwords: { ana: secret(), bruno: secret(), ldapAdmin: secret(), keycloakAdmin: secret(), databaseAdmin: databasePassword() },
    clientSecrets: { portal: secret(), example: secret() },
    ca: '',
    databases: {},
  };
  writeIdentityFiles(WORKDIR, {
    ANA_PASSWORD: state.passwords.ana,
    BRUNO_PASSWORD: state.passwords.bruno,
    CLIENT_SECRET: state.clientSecrets.portal,
    EXAMPLE_CLIENT_SECRET: state.clientSecrets.example,
    LDAP_ADMIN_PASSWORD: state.passwords.ldapAdmin,
  });
  state.ca = writeTls(WORKDIR).ca;
  save(state);
  compose(envOf(state), '--profile', engine, 'up', '-d', '--wait', '--wait-timeout', '600');
  console.log(`laboratory up: Keycloak on http://localhost:8081, ${engine} on localhost (TLS)`);
}

function database([system, environment]: string[]): void {
  if (!system || !environment) throw new Failure('usage: node lab/lab.ts database <system> <environment>');
  const state = load();
  const credentials = provision(envOf(state), state.engine, system, environment);
  state.databases[credentials.database] = credentials;
  save(state);
  console.log(`created ${credentials.database} on ${state.engine}, logins ${credentials.application.user} and ${credentials.migration.user}`);
}

function config(args: string[]): void {
  const [system, environment] = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--out');
  const out = option(args, '--out');
  if (!system || !environment || !out) throw new Failure('usage: node lab/lab.ts config <system> <environment> --out <file> [--migration]');
  const state = load();
  const credentials = state.databases[`${system.replaceAll('-', '_')}_${environment}`];
  if (!credentials) throw new Failure(`no database for ${system} ${environment}; run \`node lab/lab.ts database ${system} ${environment}\``);
  const migration = args.includes('--migration');
  const clientSecret = state.clientSecrets[system as 'portal' | 'example'];
  if (!migration && !clientSecret) throw new Failure(`the laboratory realm has clients portal and example only, not ${system}`);
  // The migration step receives the migration login and nothing else (ADR-0016, item 6).
  const values = migration
    ? databaseKeys(credentials, 'migration', state.ca)
    : {
        PUBLIC_URL: system === 'portal' ? 'http://localhost:3999' : 'http://localhost:5173',
        OIDC_ISSUER: 'http://localhost:8081/realms/internal',
        OIDC_CLIENT_ID: system,
        OIDC_CLIENT_SECRET: clientSecret!,
        OIDC_ALLOW_INSECURE_ISSUER: 'true',
        LOG_LEVEL: 'info',
        ...databaseKeys(credentials, 'application', state.ca),
      };
  writeFileSync(out, `${JSON.stringify(values, null, 2)}\n`, { mode: 0o600 });
  console.log(`wrote ${out} (${migration ? 'migration' : 'application'} login; laboratory secrets, never commit it)`);
}

function password([person]: string[]): void {
  const state = load();
  if (person !== 'ana' && person !== 'bruno') throw new Failure('people of the laboratory: ana (TI) and bruno (Vendas)');
  console.log(state.passwords[person]);
}

function down(): void {
  if (existsSync(STATE)) {
    const state = load();
    compose(envOf(state), '--profile', 'postgresql', '--profile', 'sqlserver', 'down', '-v');
  }
  rmSync(WORKDIR, { recursive: true, force: true });
  console.log('laboratory removed, secrets deleted');
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'up') up(rest);
  else if (command === 'database') database(rest);
  else if (command === 'config') config(rest);
  else if (command === 'password') password(rest);
  else if (command === 'down') down();
  else throw new Failure('usage: node lab/lab.ts <up | database | config | password | down>');
} catch (error) {
  if (error instanceof Failure) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
