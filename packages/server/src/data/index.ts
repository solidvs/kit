/**
 * The data layer without NestJS: what `prisma.config.ts`, scripts and the migration step need
 * (ADR-0016). The NestJS module is exported from the package root.
 */
export { createDriverAdapter } from './adapter.js';
export {
  AUDIT_EVENT_MODEL,
  assertDatabaseProtection,
  auditEventSchema,
  auditProtectionSql,
  AuditTrail,
  DatabaseProtectionError,
  type AuditEvent,
  type PlatformDatabaseClient,
} from './audit-trail.js';
export { prismaCliUrl } from './cli-datasource.js';
export { databaseConfigSchema, type DatabaseConfig } from './database-config.js';
export { DATABASE_ENGINES, databaseEngine, DEFAULT_PORTS, isDatabaseEngine, REFERENCE_ENGINE, type DatabaseEngine } from './engine.js';
export { deriveSqlServerSchema, NeutralSchemaError, neutralSchemaProblems } from './neutral-schema.js';
// Configuration loading without NestJS, for prisma.config.ts and the migration step.
export { ConfigError, loadConfig } from '../config/load-config.js';
