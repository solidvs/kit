import { z } from 'zod';

/**
 * Database keys of a system's configuration file (ADR-0016). The same keys serve both logins: the
 * running service receives the application login, the migration step receives the migration login,
 * each in its own file. There is no connection string and no setting that skips certificate checks.
 */
export const databaseConfigSchema = z.object({
  DATABASE_HOST: z.string().min(1),
  /** Default: 5432 for PostgreSQL, 1433 for SQL Server. */
  DATABASE_PORT: z.coerce.number().int().positive().optional(),
  /** `<system>_<environment>`, created by the provisioning procedure. */
  DATABASE_NAME: z.string().regex(/^[a-z][a-z0-9_]{0,62}$/, 'lowercase letters, digits and underscores'),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  /**
   * PEM certificate of the authority that signed the server's certificate, when it is not a public
   * one (an internal CA, or the laboratory's certificate). Connections are always encrypted and the
   * certificate is always verified; this only adds a trusted authority.
   */
  DATABASE_TLS_CA: z
    .string()
    .includes('-----BEGIN CERTIFICATE-----', { message: 'must be a PEM certificate' })
    .optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
