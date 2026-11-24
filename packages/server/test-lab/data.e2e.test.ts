/**
 * End-to-end check of ADR-0016 against a real database engine of the laboratory:
 * provisioning procedure, migrations written by `solidvs-data` and applied by the Prisma CLI with
 * the migration login, then the data module with the application login.
 *
 *   pnpm --filter @solidvs/server build
 *   pnpm --filter @solidvs/server test:lab:data                       PostgreSQL
 *   LAB_DATABASE_ENGINE=sqlserver LAB_MSSQL_ACCEPT_EULA=Y pnpm …         SQL Server
 *
 * Needs Docker; runs beside nothing else of the laboratory (same ports). Secrets are generated
 * for the run and deleted with the containers.
 */
import 'reflect-metadata';

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { compose, databaseKeys, databasePassword, labEnv, provision, secret, writeTls, type Credentials, type Engine } from '../../../lab/lib.ts';
import { AuditTrail, createDriverAdapter, DATABASE_CLIENT, DataModule, databaseConfigSchema, prismaCliUrl, type DatabaseConfig } from '../src/index.js';

const engine = (process.env.LAB_DATABASE_ENGINE ?? 'postgresql') as Engine;
const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE = join(HERE, '..');
const CLI = join(PACKAGE, 'dist', 'cli', 'solidvs-data.js');
const PRISMA = join(PACKAGE, 'node_modules', 'prisma', 'build', 'index.js');
const WORK = join(HERE, '.work', engine);

mkdirSync(join(homedir(), '.cache', 'platform-kit-lab'), { recursive: true });
const workdir = mkdtempSync(join(homedir(), '.cache', 'platform-kit-lab', `data-${engine}-`));
const env = {
  ...labEnv(workdir, { ldapAdmin: secret(), keycloakAdmin: secret(), databaseAdmin: databasePassword() }),
  COMPOSE_PROJECT_NAME: `platform-kit-data-${engine}`,
};

/** A minimal client shape for the assertions; the real one is the generated PrismaClient. */
type Client = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  auditEvent: { create(args: unknown): Promise<unknown>; findMany(args?: unknown): Promise<Array<{ action: string; details: string | null }>> };
  note: { create(args: unknown): Promise<{ id: string }>; update(args: unknown): Promise<unknown>; delete(args: unknown): Promise<unknown> };
};

let PrismaClient: new (options: { adapter: unknown }) => Client;
let credentials: Credentials;
let ca: string;

function prisma(args: string[], url: string): { status: number | null; output: string } {
  const result = spawnSync(process.execPath, [PRISMA, ...args, '--config', 'prisma.config.mjs'], {
    cwd: WORK,
    env: { ...process.env, DATABASE_ENGINE: engine, MIGRATE_URL: url, PRISMA_HIDE_UPDATE_MESSAGE: '1', CHECKPOINT_DISABLE: '1' },
    encoding: 'utf8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const configFor = (login: 'application' | 'migration', overrides: Partial<DatabaseConfig> = {}): DatabaseConfig => ({
  ...databaseConfigSchema.parse(databaseKeys(credentials, login, ca)),
  ...overrides,
});

async function clientFor(login: 'application' | 'migration', overrides: Partial<DatabaseConfig> = {}): Promise<Client> {
  const client = new PrismaClient({ adapter: await createDriverAdapter(engine, configFor(login, overrides)) });
  await client.$connect();
  return client;
}

describe(`ADR-0016 end to end on ${engine}`, () => {
  let app: Client;

  beforeAll(async () => {
    if (!existsSync(CLI)) throw new Error('build the package first: pnpm --filter @solidvs/server build');
    ca = writeTls(workdir).ca;
    compose(env, '--profile', engine, 'up', '-d', '--wait', '--wait-timeout', '600', engine);
    credentials = provision(env, engine, 'kit-test', 'lab');

    // A system's prisma folder: reference model → migrations for both engines, no database.
    rmSync(WORK, { recursive: true, force: true });
    mkdirSync(join(WORK, 'prisma'), { recursive: true });
    cpSync(join(HERE, 'data', 'schema.prisma'), join(WORK, 'prisma', 'schema.prisma'));
    writeFileSync(join(WORK, 'package.json'), '{ "private": true, "type": "module" }\n');
    writeFileSync(
      join(WORK, 'prisma.config.mjs'),
      `const engine = process.env.DATABASE_ENGINE;
export default {
  schema: engine === 'postgresql' ? 'prisma/schema.prisma' : 'prisma/sqlserver/schema.prisma',
  migrations: { path: \`prisma/migrations/\${engine}\` },
  datasource: { url: process.env.MIGRATE_URL },
};
`,
    );
    execFileSync(process.execPath, [CLI, 'migration', 'init'], { cwd: WORK, stdio: 'pipe' });

    const migrationUrl = prismaCliUrl(engine, configFor('migration'));
    const generated = prisma(['generate'], migrationUrl);
    if (generated.status !== 0) throw new Error(generated.output);
    const deployed = prisma(['migrate', 'deploy'], migrationUrl);
    if (deployed.status !== 0) throw new Error(deployed.output);

    ({ PrismaClient } = (await import(join(WORK, 'generated', 'client.ts'))) as { PrismaClient: typeof PrismaClient });
    app = await clientFor('application');
  }, 900_000);

  afterAll(async () => {
    await app?.$disconnect();
    compose(env, '--profile', engine, 'down', '-v');
    rmSync(workdir, { recursive: true, force: true });
    rmSync(WORK, { recursive: true, force: true });
  }, 300_000);

  it('the provisioning procedure refuses to run twice', () => {
    expect(() => provision(env, engine, 'kit-test', 'lab')).toThrow();
  });

  it('migrations reproduce the model exactly', () => {
    const diff = prisma(['migrate', 'diff', '--from-config-datasource', '--to-schema', engine === 'postgresql' ? 'prisma/schema.prisma' : 'prisma/sqlserver/schema.prisma', '--exit-code'], prismaCliUrl(engine, configFor('migration')));
    expect(diff.output).not.toMatch(/CREATE|ALTER|DROP/);
    expect(diff.status).toBe(0);
  });

  it('the application login cannot apply migrations', () => {
    expect(prisma(['migrate', 'deploy'], prismaCliUrl(engine, configFor('application'))).status).not.toBe(0);
  });

  it('starts the data module with the application login and records audit events', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DataModule.forRoot({ engine, config: configFor('application'), createClient: (adapter) => new PrismaClient({ adapter }) as never })],
    }).compile();
    const nest = moduleRef.createNestApplication();
    await nest.init();
    await nest.get(AuditTrail).record({ actor: 'ana', action: 'note.created', subjectType: 'note', subjectId: 'n-1', details: { title: 'Synthetic' } });
    const client = nest.get<Client>(DATABASE_CLIENT);
    expect(await client.auditEvent.findMany({ where: { action: 'note.created' } })).toEqual([expect.objectContaining({ details: '{"title":"Synthetic"}' })]);
    await nest.close();
  });

  it('the application login reads and writes business rows', async () => {
    const note = await app.note.create({ data: { title: 'Synthetic note' } });
    await app.note.update({ where: { id: note.id }, data: { body: 'Changed' } });
    await app.note.delete({ where: { id: note.id } });
  });

  it('audit_event is insert-only for the application login', async () => {
    await app.auditEvent.create({ data: { occurredAt: new Date(), actor: 'ana', action: 'note.read', subjectType: 'note' } });
    await expect(app.$executeRawUnsafe(`UPDATE audit_event SET actor = 'mallory'`)).rejects.toThrow();
    await expect(app.$executeRawUnsafe('DELETE FROM audit_event')).rejects.toThrow();
    await expect(app.$executeRawUnsafe('TRUNCATE TABLE audit_event')).rejects.toThrow();
  });

  it('audit_event is insert-only for the migration login too', async () => {
    const migration = await clientFor('migration');
    try {
      await expect(migration.$executeRawUnsafe(`UPDATE audit_event SET actor = 'mallory'`)).rejects.toThrow(/insert-only/);
      await expect(migration.$executeRawUnsafe('DELETE FROM audit_event')).rejects.toThrow(/insert-only/);
    } finally {
      await migration.$disconnect();
    }
  });

  it('the application login has no DDL and cannot touch the migration history', async () => {
    await expect(app.$executeRawUnsafe('CREATE TABLE intruder (id INT)')).rejects.toThrow();
    await expect(app.$executeRawUnsafe('DROP TABLE note')).rejects.toThrow();
    await expect(app.$executeRawUnsafe('DELETE FROM _prisma_migrations')).rejects.toThrow();
  });

  it('the data module refuses to start with the migration login', async () => {
    const moduleRef = Test.createTestingModule({
      imports: [DataModule.forRoot({ engine, config: configFor('migration'), createClient: (adapter) => new PrismaClient({ adapter }) as never })],
    });
    await expect(moduleRef.compile()).rejects.toThrow(/DDL rights/);
  });

  it('connections verify the server certificate', async () => {
    const other = mkdtempSync(join(workdir, 'other-'));
    const otherCa = writeTls(other).ca;
    await expect(clientFor('application', { DATABASE_TLS_CA: otherCa }).then((c) => c.$queryRawUnsafe('SELECT 1'))).rejects.toThrow();
    expect(readFileSync(join(workdir, 'tls', 'ca.crt'), 'utf8')).toBe(ca);
  });
});
