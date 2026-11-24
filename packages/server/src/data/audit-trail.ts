import { z } from 'zod';

import type { DatabaseEngine } from './engine.js';

/**
 * The business audit trail (ADR-0016, item 7): one insert-only table, `audit_event`, owned by the
 * platform kit. Every system copies `AUDIT_EVENT_MODEL` into its Prisma schema; the migration
 * command appends `auditProtectionSql` to the migration that creates the table; the data module
 * refuses to start when the protection is missing.
 */
export const AUDIT_EVENT_MODEL = `/// Business audit trail, owned by @solidvs/server (ADR-0016): insert-only, enforced by the
/// database. Keep this model exactly as the platform kit defines it (AUDIT_EVENT_MODEL).
model AuditEvent {
  id          BigInt   @id @default(autoincrement())
  occurredAt  DateTime @map("occurred_at")
  actor       String   @db.VarChar(200)
  action      String   @db.VarChar(100)
  subjectType String   @map("subject_type") @db.VarChar(100)
  subjectId   String?  @map("subject_id") @db.VarChar(200)
  details     String?  @db.Text

  @@index([subjectType, subjectId])
  @@map("audit_event")
}`;

const POSTGRESQL_PROTECTION = `
-- Platform protection (ADR-0016), appended by \`solidvs-data migration\`: audit_event is insert-only
-- for every login, and the application login can neither change it nor the migration history.
CREATE FUNCTION "audit_event_refuse_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_event is insert-only';
END;
$$;

CREATE TRIGGER "audit_event_insert_only" BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION "audit_event_refuse_change"();

CREATE TRIGGER "audit_event_no_truncate" BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_event_refuse_change"();

DO $$
DECLARE
  application_login text := current_database() || '_app';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = application_login) THEN
    EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON "audit_event" FROM %I', application_login);
    EXECUTE format('REVOKE ALL ON "_prisma_migrations" FROM %I', application_login);
  END IF;
END;
$$;
`;

const SQLSERVER_PROTECTION = `
-- Platform protection (ADR-0016), appended by \`solidvs-data migration\`: audit_event is insert-only
-- for every login, and the application user can neither change it nor the migration history.
EXEC('CREATE TRIGGER [dbo].[audit_event_insert_only] ON [dbo].[audit_event] INSTEAD OF UPDATE, DELETE AS BEGIN SET NOCOUNT ON; THROW 50001, ''audit_event is insert-only'', 1; END');

IF DATABASE_PRINCIPAL_ID('app') IS NOT NULL
BEGIN
    DENY UPDATE, DELETE ON [dbo].[audit_event] TO [app];
    DENY SELECT, INSERT, UPDATE, DELETE ON [dbo].[_prisma_migrations] TO [app];
END;
`;

/** SQL that makes `audit_event` insert-only; part of the migration that creates the table. */
export function auditProtectionSql(engine: DatabaseEngine): string {
  return engine === 'postgresql' ? POSTGRESQL_PROTECTION : SQLSERVER_PROTECTION;
}

/**
 * One query, run by the service's own login, that proves the protection is in place: the trigger
 * is enabled, and this login may not update or delete audit rows, write the migration history or
 * create tables. A service started with the migration login fails here too.
 */
const PROTECTION_CHECKS: Record<DatabaseEngine, string> = {
  postgresql: `SELECT
    (SELECT count(*)::int FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'audit_event' AND t.tgname IN ('audit_event_insert_only', 'audit_event_no_truncate')
        AND t.tgenabled <> 'D') = 2 AS "triggerEnabled",
    has_table_privilege('audit_event', 'UPDATE') OR has_table_privilege('audit_event', 'DELETE')
      OR has_table_privilege('audit_event', 'TRUNCATE') AS "canChangeAudit",
    has_table_privilege('_prisma_migrations', 'INSERT') OR has_table_privilege('_prisma_migrations', 'UPDATE')
      OR has_table_privilege('_prisma_migrations', 'DELETE') AS "canWriteHistory",
    has_schema_privilege('public', 'CREATE') OR has_database_privilege(current_database(), 'CREATE') AS "canCreate"`,
  sqlserver: `SELECT
    CAST(CASE WHEN EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'audit_event_insert_only'
      AND parent_id = OBJECT_ID('dbo.audit_event') AND is_disabled = 0) THEN 1 ELSE 0 END AS bit) AS triggerEnabled,
    CAST(CASE WHEN HAS_PERMS_BY_NAME('dbo.audit_event', 'OBJECT', 'UPDATE') = 1
      OR HAS_PERMS_BY_NAME('dbo.audit_event', 'OBJECT', 'DELETE') = 1
      OR HAS_PERMS_BY_NAME('dbo.audit_event', 'OBJECT', 'ALTER') = 1 THEN 1 ELSE 0 END AS bit) AS canChangeAudit,
    CAST(CASE WHEN HAS_PERMS_BY_NAME('dbo._prisma_migrations', 'OBJECT', 'INSERT') = 1
      OR HAS_PERMS_BY_NAME('dbo._prisma_migrations', 'OBJECT', 'UPDATE') = 1
      OR HAS_PERMS_BY_NAME('dbo._prisma_migrations', 'OBJECT', 'DELETE') = 1 THEN 1 ELSE 0 END AS bit) AS canWriteHistory,
    CAST(CASE WHEN HAS_PERMS_BY_NAME(NULL, 'DATABASE', 'CREATE TABLE') = 1
      OR HAS_PERMS_BY_NAME('dbo', 'SCHEMA', 'ALTER') = 1 THEN 1 ELSE 0 END AS bit) AS canCreate`,
};

type ProtectionRow = { triggerEnabled: unknown; canChangeAudit: unknown; canWriteHistory: unknown; canCreate: unknown };

/** What the platform kit needs from a system's generated Prisma client. */
export type PlatformDatabaseClient = {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): PromiseLike<T>;
  auditEvent: { create(args: { data: AuditEventRow }): PromiseLike<unknown> };
};

type AuditEventRow = {
  occurredAt: Date;
  actor: string;
  action: string;
  subjectType: string;
  subjectId: string | null;
  details: string | null;
};

export class DatabaseProtectionError extends Error {
  constructor(problems: string[]) {
    super(`The database is not protected as the platform requires (ADR-0016):\n- ${problems.join('\n- ')}`);
    this.name = 'DatabaseProtectionError';
  }
}

/** Refuses a database whose audit table or login rights are not what the platform requires. */
export async function assertDatabaseProtection(client: Pick<PlatformDatabaseClient, '$queryRawUnsafe'>, engine: DatabaseEngine): Promise<void> {
  let row: ProtectionRow | undefined;
  try {
    [row] = await client.$queryRawUnsafe<ProtectionRow[]>(PROTECTION_CHECKS[engine]);
  } catch (error) {
    throw new DatabaseProtectionError([`cannot inspect the database: ${(error as Error).message.split('\n')[0]}; were the migrations applied?`]);
  }
  const problems: string[] = [];
  if (!truthy(row?.triggerEnabled)) problems.push('the insert-only trigger of audit_event is missing or disabled');
  if (truthy(row?.canChangeAudit)) problems.push('this login may update or delete audit_event');
  if (truthy(row?.canWriteHistory)) problems.push('this login may write the migration history');
  if (truthy(row?.canCreate)) problems.push('this login has DDL rights; the service must run with the application login');
  if (problems.length > 0) throw new DatabaseProtectionError(problems);
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't';
}

export const auditEventSchema = z.object({
  /** Who did it: the person's username, or `system:<id>` for automatic actions. */
  actor: z.string().min(1).max(200),
  /** What happened, as `<subject>.<verb>`, e.g. `definition.published`. */
  action: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, '<subject>.<verb>, lowercase').max(100),
  subjectType: z.string().min(1).max(100),
  subjectId: z.string().min(1).max(200).optional(),
  /** Small structured context. Never secrets, never more personal data than the action needs. */
  details: z.record(z.string(), z.unknown()).optional(),
});

export type AuditEvent = z.input<typeof auditEventSchema>;

/** Writes business audit events (A.8.15). Events are never changed or deleted. */
export class AuditTrail {
  constructor(
    private readonly client: Pick<PlatformDatabaseClient, 'auditEvent'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async record(event: AuditEvent): Promise<void> {
    const valid = auditEventSchema.parse(event);
    await this.client.auditEvent.create({
      data: {
        occurredAt: this.now(),
        actor: valid.actor,
        action: valid.action,
        subjectType: valid.subjectType,
        subjectId: valid.subjectId ?? null,
        details: valid.details ? JSON.stringify(valid.details) : null,
      },
    });
  }
}
