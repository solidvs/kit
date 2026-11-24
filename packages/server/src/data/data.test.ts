import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { assertDatabaseProtection, auditProtectionSql, AuditTrail, DatabaseProtectionError } from './audit-trail.js';
import { prismaCliUrl } from './cli-datasource.js';
import { databaseConfigSchema } from './database-config.js';
import { databaseEngine } from './engine.js';

const PEM = '-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n';
const config = databaseConfigSchema.parse({
  DATABASE_HOST: 'db.internal',
  DATABASE_NAME: 'orders_staging',
  DATABASE_USER: 'orders_staging_app',
  DATABASE_PASSWORD: 'p@ss;w}rd',
});

describe('database configuration', () => {
  it('has no connection string and no way to skip certificate checks', () => {
    expect(Object.keys(databaseConfigSchema.shape).sort()).toEqual([
      'DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_PASSWORD', 'DATABASE_POOL_MAX', 'DATABASE_PORT', 'DATABASE_TLS_CA', 'DATABASE_USER',
    ]);
  });

  it('refuses a database name outside the convention and a CA that is not PEM', () => {
    expect(databaseConfigSchema.safeParse({ ...config, DATABASE_NAME: 'Orders-Staging' }).success).toBe(false);
    expect(databaseConfigSchema.safeParse({ ...config, DATABASE_TLS_CA: 'not a certificate' }).success).toBe(false);
  });

  it('takes the engine from the build, PostgreSQL by default', () => {
    expect(databaseEngine({})).toBe('postgresql');
    expect(databaseEngine({ DATABASE_ENGINE: 'sqlserver' })).toBe('sqlserver');
    expect(() => databaseEngine({ DATABASE_ENGINE: 'mysql' })).toThrow('DATABASE_ENGINE');
  });
});

describe('CLI connection URL', () => {
  it('PostgreSQL: TLS required, chain and host checked, credentials escaped', () => {
    const url = new URL(prismaCliUrl('postgresql', config));
    expect(url.host).toBe('db.internal:5432');
    expect(url.pathname).toBe('/orders_staging');
    expect(decodeURIComponent(url.password)).toBe('p@ss;w}rd');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('sslaccept')).toBe('strict');
    expect(url.searchParams.has('sslcert')).toBe(false);
  });

  it('SQL Server: encryption on, server certificate trusted only through a CA, values braced', () => {
    const url = prismaCliUrl('sqlserver', { ...config, DATABASE_TLS_CA: PEM });
    expect(url).toMatch(/^sqlserver:\/\/db\.internal:1433;database=orders_staging;/);
    expect(url).toContain('user={orders_staging_app};password={p@ss;w}}rd}');
    expect(url).toContain('encrypt=true;trustServerCertificate=false;');
    const caFile = /trustServerCertificateCA=\{([^}]+)\}/.exec(url)?.[1];
    expect(readFileSync(caFile!, 'utf8')).toBe(PEM);
  });
});

describe('audit trail', () => {
  it('writes one validated row, details as JSON, time from the clock', async () => {
    const rows: unknown[] = [];
    const trail = new AuditTrail({ auditEvent: { create: async (args) => rows.push(args.data) } }, () => new Date('2026-11-24T12:00:00Z'));
    await trail.record({ actor: 'ana', action: 'definition.published', subjectType: 'definition', subjectId: 'identity.forgotPasswordUrl', details: { version: 3 } });
    expect(rows).toEqual([
      {
        occurredAt: new Date('2026-11-24T12:00:00Z'),
        actor: 'ana',
        action: 'definition.published',
        subjectType: 'definition',
        subjectId: 'identity.forgotPasswordUrl',
        details: '{"version":3}',
      },
    ]);
  });

  it('refuses an action outside the <subject>.<verb> convention', async () => {
    const trail = new AuditTrail({ auditEvent: { create: async () => undefined } });
    await expect(trail.record({ actor: 'ana', action: 'Published', subjectType: 'definition' })).rejects.toThrow();
  });

  it('protection SQL: trigger for every login, rights taken from the application login', () => {
    expect(auditProtectionSql('postgresql')).toMatch(/BEFORE UPDATE OR DELETE ON "audit_event"/);
    expect(auditProtectionSql('postgresql')).toMatch(/BEFORE TRUNCATE ON "audit_event"/);
    expect(auditProtectionSql('postgresql')).toContain(`current_database() || '_app'`);
    expect(auditProtectionSql('sqlserver')).toMatch(/INSTEAD OF UPDATE, DELETE/);
    expect(auditProtectionSql('sqlserver')).toContain('DENY UPDATE, DELETE ON [dbo].[audit_event] TO [app]');
  });
});

describe('start-up protection check', () => {
  const answering = (row: Record<string, unknown>) => ({ $queryRawUnsafe: async <T>() => [row] as T });
  const safe = { triggerEnabled: true, canChangeAudit: false, canWriteHistory: false, canCreate: false };

  it('passes a protected database seen through the application login', async () => {
    await expect(assertDatabaseProtection(answering(safe), 'postgresql')).resolves.toBeUndefined();
    await expect(assertDatabaseProtection(answering({ triggerEnabled: 1, canChangeAudit: 0, canWriteHistory: 0, canCreate: 0 }), 'sqlserver')).resolves.toBeUndefined();
  });

  it.each([
    [{ triggerEnabled: false }, 'trigger'],
    [{ canChangeAudit: true }, 'update or delete audit_event'],
    [{ canWriteHistory: true }, 'migration history'],
    [{ canCreate: true }, 'DDL rights'],
  ])('refuses %j', async (change, message) => {
    await expect(assertDatabaseProtection(answering({ ...safe, ...change }), 'postgresql')).rejects.toThrow(message);
  });

  it('refuses a database without the migrations', async () => {
    const failing = { $queryRawUnsafe: async () => Promise.reject(new Error('relation "_prisma_migrations" does not exist')) };
    await expect(assertDatabaseProtection(failing, 'postgresql')).rejects.toThrow(DatabaseProtectionError);
  });
});
