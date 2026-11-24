#!/usr/bin/env node
/**
 * Schema and migrations of a system for every supported engine (ADR-0016). Run it from the folder
 * that holds `prisma/` (the API package):
 *
 *   solidvs-data derive [--check]      prisma/schema.prisma → prisma/sqlserver/schema.prisma
 *   solidvs-data migration <name>      one new migration per engine, from the change in the model
 *   solidvs-data migration --check     fails when the model changed without a migration
 *   solidvs-data drift                 fails when the database (prisma.config.ts, migration login)
 *                                     differs from the model of the build's engine
 *   solidvs-data lab up --system <id> [--engine <DATABASE_ENGINE>] [--environment dev]
 *                     [--app-config <file>] [--migration-config <file>]
 *                                     a laboratory database for development and CI (never staging
 *                                     or production): one container, provisioned by the same
 *                                     procedure as the real servers; writes the configuration keys
 *                                     of the application login and of the migration login
 *   solidvs-data lab down              removes it, with its data and secrets
 *
 * Migrations are generated from model to model (`prisma migrate diff --from-schema`), so no
 * database is needed to write them. The previous model is kept in prisma/migrations/model.prisma.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { AUDIT_EVENT_MODEL, auditProtectionSql } from '../data/audit-trail.js';
import { DATABASE_ENGINES, databaseEngine, isDatabaseEngine, type DatabaseEngine } from '../data/engine.js';
import { deriveSqlServerSchema, NeutralSchemaError } from '../data/neutral-schema.js';
import {
  containerClients,
  labDatabaseKeys,
  labPassword,
  provisionDatabase,
  removeDatabaseContainer,
  startDatabaseContainer,
  writeLabTls,
} from '../lab/database-lab.js';

const ROOT = process.cwd();
const REFERENCE = join(ROOT, 'prisma', 'schema.prisma');
const DERIVED = join(ROOT, 'prisma', 'sqlserver', 'schema.prisma');
const MIGRATIONS = join(ROOT, 'prisma', 'migrations');
const SNAPSHOT = join(MIGRATIONS, 'model.prisma');

class Failure extends Error {}

function schemaFor(engine: DatabaseEngine, reference: string, sourcePath = REFERENCE, targetPath = DERIVED): string {
  return engine === 'postgresql' ? reference : deriveSqlServerSchema(reference, { sourcePath, targetPath });
}

/** The reference schema, checked: neutral rules, and the platform's audit model kept intact. */
function readReference(): string {
  if (!existsSync(REFERENCE)) throw new Failure(`${REFERENCE} not found; run this command in the folder that holds prisma/`);
  const reference = readFileSync(REFERENCE, 'utf8');
  const squeeze = (text: string) => text.replace(/\s+/g, ' ').trim();
  if (!squeeze(reference).includes(squeeze(AUDIT_EVENT_MODEL))) {
    throw new Failure('prisma/schema.prisma must contain the AuditEvent model exactly as AUDIT_EVENT_MODEL of @solidvs/server defines it');
  }
  schemaFor('sqlserver', reference); // throws NeutralSchemaError
  return reference;
}

function derive(check: boolean): void {
  const derived = `${schemaFor('sqlserver', readReference())}`;
  const current = existsSync(DERIVED) ? readFileSync(DERIVED, 'utf8') : undefined;
  if (check) {
    if (current !== derived) throw new Failure('prisma/sqlserver/schema.prisma is stale; run `solidvs-data derive` and commit the result');
    console.log('prisma/sqlserver/schema.prisma is up to date');
    return;
  }
  mkdirSync(join(ROOT, 'prisma', 'sqlserver'), { recursive: true });
  writeFileSync(DERIVED, derived);
  console.log('wrote prisma/sqlserver/schema.prisma');
}

const DUMMY_URLS: Record<DatabaseEngine, string> = {
  postgresql: 'postgresql://unused@localhost:5432/unused',
  sqlserver: 'sqlserver://localhost:1433;database=unused',
};

/** SQL that takes one model to the other, for one engine, without a database. */
function diff(engine: DatabaseEngine, from: string | undefined, to: string, scratch: string): string {
  const write = (name: string, text: string) => {
    const dir = join(scratch, engine, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'schema.prisma'), text);
    return join(dir, 'schema.prisma');
  };
  // The CLI wants a datasource even for a model-to-model diff; it never connects to it.
  const config = join(scratch, `${engine}.config.mjs`);
  writeFileSync(config, `export default { datasource: { url: ${JSON.stringify(DUMMY_URLS[engine])} } };\n`);
  const prisma = createRequire(join(ROOT, 'package.json')).resolve('prisma/build/index.js');
  const args = [prisma, 'migrate', 'diff', '--config', config, '--script'];
  args.push(...(from === undefined ? ['--from-empty'] : ['--from-schema', write('from', from)]), '--to-schema', write('to', to));
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' } });
  if (result.status !== 0) throw new Failure(`prisma migrate diff failed for ${engine}:\n${result.stderr || result.stdout}`);
  return result.stdout;
}

function isEmpty(sql: string): boolean {
  return sql.replace(/--.*$/gm, '').trim() === '';
}

/** Appends the audit protection to the migration that creates audit_event (ADR-0016, item 7). */
function withPlatformProtection(engine: DatabaseEngine, sql: string): string {
  const creates = engine === 'postgresql' ? /CREATE TABLE "audit_event"/ : /CREATE TABLE \[dbo\]\.\[audit_event\]/;
  if (!creates.test(sql)) return sql;
  const protection = auditProtectionSql(engine);
  if (engine === 'postgresql') return `${sql.trimEnd()}\n${protection}`;
  // Prisma wraps SQL Server migrations in one transaction; the protection belongs inside it.
  if (!sql.includes('COMMIT TRAN;')) throw new Failure('unexpected SQL Server migration layout: COMMIT TRAN not found');
  return sql.replace('COMMIT TRAN;', `${protection.trim()}\n\nCOMMIT TRAN;`);
}

/**
 * The lock file Prisma checks before applying a folder. Prisma 7's schema engine names SQL Server
 * `mssql` here (not `sqlserver`, the schema's provider) and refuses anything else.
 */
const LOCK_PROVIDERS: Record<DatabaseEngine, string> = { postgresql: 'postgresql', sqlserver: 'mssql' };

function lockFile(engine: DatabaseEngine): string {
  return `# Written by solidvs-data. Migrations of this folder are for ${engine} only.\nprovider = "${LOCK_PROVIDERS[engine]}"\n`;
}

function timestamp(date = new Date()): string {
  return date.toISOString().replace(/\D/g, '').slice(0, 14);
}

function migration(name: string | undefined, check: boolean): void {
  const reference = readReference();
  const previous = existsSync(SNAPSHOT) ? readFileSync(SNAPSHOT, 'utf8') : undefined;
  if (check) {
    if (previous !== reference) throw new Failure('the model changed without a migration; run `solidvs-data migration <name>` and commit the result');
    console.log('every change of the model has its migrations');
    return;
  }
  if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) throw new Failure('name the migration in lowercase snake_case, e.g. `add_order_status`');

  const scratch = mkdtempSync(join(tmpdir(), 'solidvs-data-'));
  try {
    const sqlByEngine = DATABASE_ENGINES.map((engine) => {
      const from = previous === undefined ? undefined : schemaFor(engine, previous, REFERENCE, DERIVED);
      return [engine, withPlatformProtection(engine, diff(engine, from, schemaFor(engine, reference), scratch))] as const;
    });
    if (sqlByEngine.every(([, sql]) => isEmpty(sql))) {
      console.log('the model has not changed; no migration written');
      return;
    }
    const folder = `${timestamp()}_${name}`;
    for (const [engine, sql] of sqlByEngine) {
      const dir = join(MIGRATIONS, engine, folder);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'migration.sql'), sql);
      writeFileSync(join(MIGRATIONS, engine, 'migration_lock.toml'), lockFile(engine));
      console.log(`wrote prisma/migrations/${engine}/${folder}/migration.sql`);
    }
    writeFileSync(SNAPSHOT, reference);
    derive(false);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

/** After `prisma migrate deploy`: the database must match the model exactly (ADR-0016, item 5). */
function drift(): void {
  const engine = databaseEngine();
  const prisma = createRequire(join(ROOT, 'package.json')).resolve('prisma/build/index.js');
  const schema = engine === 'postgresql' ? 'prisma/schema.prisma' : 'prisma/sqlserver/schema.prisma';
  const result = spawnSync(process.execPath, [prisma, 'migrate', 'diff', '--from-config-datasource', '--to-schema', schema, '--exit-code', '--script'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
  });
  if (result.status === 0) {
    console.log(`the ${engine} database matches the model`);
    return;
  }
  throw new Failure(`the ${engine} database differs from the model (or could not be read):\n${result.stdout}${result.stderr}`);
}

const LAB_PORTS: Record<DatabaseEngine, number> = { postgresql: 55432, sqlserver: 51433 };
const LAB_STATE = join(ROOT, '.lab', 'state.json');

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Merges keys into a JSON configuration file (created if missing), readable by its owner only. */
function writeConfig(file: string, keys: Record<string, string>): void {
  const path = resolve(ROOT, file);
  const current = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>) : {};
  writeFileSync(path, `${JSON.stringify({ ...current, ...keys }, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
  console.log(`wrote the database keys to ${file} (laboratory secrets; never commit it)`);
}

function labUp(args: string[]): void {
  const system = option(args, '--system');
  const engine = option(args, '--engine') ?? databaseEngine();
  const environment = option(args, '--environment') ?? 'dev';
  if (!system) throw new Failure('usage: solidvs-data lab up --system <id> [--engine postgresql|sqlserver] [--environment dev] [--app-config <file>] [--migration-config <file>]');
  if (!isDatabaseEngine(engine)) throw new Failure(`--engine is one of ${DATABASE_ENGINES.join(', ')}`);
  if (existsSync(LAB_STATE)) throw new Failure('a laboratory database is already running here; `solidvs-data lab down` first');

  const name = `${system}-${engine}-lab`;
  const port = Number(option(args, '--port') ?? LAB_PORTS[engine]);
  // Under the home folder: Docker virtual machines on macOS share only that folder with the host.
  mkdirSync(join(homedir(), '.cache', 'solidvs-data-lab'), { recursive: true });
  const workdir = mkdtempSync(join(homedir(), '.cache', 'solidvs-data-lab', `${name}-`));
  mkdirSync(join(ROOT, '.lab'), { recursive: true, mode: 0o700 });
  writeFileSync(LAB_STATE, `${JSON.stringify({ engine, name, workdir })}\n`, { mode: 0o600 });

  const adminPassword = labPassword();
  const { ca } = writeLabTls(workdir);
  startDatabaseContainer(engine, { name, port, workdir, adminPassword });
  const credentials = provisionDatabase(engine, system, environment, { clients: containerClients('docker exec -i', name), adminPassword });
  writeConfig(option(args, '--app-config') ?? '.lab/application.json', labDatabaseKeys(credentials, 'application', ca, port));
  writeConfig(option(args, '--migration-config') ?? '.lab/migration.json', labDatabaseKeys(credentials, 'migration', ca, port));
  console.log(`${engine} on localhost:${port}, database ${credentials.database}, logins ${credentials.application.user} and ${credentials.migration.user}`);
}

function labDown(): void {
  if (!existsSync(LAB_STATE)) {
    console.log('no laboratory database here');
    return;
  }
  const state = JSON.parse(readFileSync(LAB_STATE, 'utf8')) as { name: string; workdir: string };
  removeDatabaseContainer(state.name);
  rmSync(state.workdir, { recursive: true, force: true });
  rmSync(join(ROOT, '.lab'), { recursive: true, force: true });
  console.log(`removed ${state.name} and its secrets (configuration files written elsewhere keep their keys)`);
}

function main(argv: string[]): void {
  const [command, ...rest] = argv;
  const check = rest.includes('--check');
  const positional = rest.filter((arg) => !arg.startsWith('--'));
  if (command === 'derive') derive(check);
  else if (command === 'migration') migration(positional[0], check);
  else if (command === 'drift') drift();
  else if (command === 'lab' && positional[0] === 'up') labUp(rest.slice(1));
  else if (command === 'lab' && positional[0] === 'down') labDown();
  else throw new Failure('usage: solidvs-data <derive [--check] | migration <name> | migration --check | drift | lab up | lab down>');
}

try {
  main(process.argv.slice(2));
} catch (error) {
  if (error instanceof Failure || error instanceof NeutralSchemaError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
