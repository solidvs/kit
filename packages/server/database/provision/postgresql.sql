-- Provisioning of one system's database on PostgreSQL (ADR-0016). Normally run through
-- `database/provision.sh` (shipped in @solidvs/server), which generates the passwords; it reads, from the environment:
--   SYSTEM, ENVIRONMENT       e.g. orders, staging → database orders_staging
--   APP_PASSWORD              application login <database>_app: data only, no DDL
--   MIGRATION_PASSWORD        migration login <database>_migration: DDL in this database only
-- Run as a platform administrator (a superuser, or a role that may create roles and databases).
-- The CREATE ROLE statements carry the passwords: keep statement logging off while it runs.
\set ON_ERROR_STOP on
\set QUIET on
\getenv system SYSTEM
\getenv environment ENVIRONMENT
\getenv app_password APP_PASSWORD
\getenv migration_password MIGRATION_PASSWORD

SELECT :'system' || '_' || :'environment' AS database \gset
SELECT :'database' || '_app' AS app, :'database' || '_migration' AS migration \gset

-- Checks before anything is created: names, password strength, and nothing left from before.
SELECT set_config('provision.database', :'database', false),
       set_config('provision.app_password', :'app_password', false),
       set_config('provision.migration_password', :'migration_password', false) \gset discard_
DO $$
DECLARE
  db text := current_setting('provision.database');
BEGIN
  IF db !~ '^[a-z][a-z0-9_]{0,50}$' THEN
    RAISE EXCEPTION 'system and environment: lowercase letters, digits and underscores';
  END IF;
  IF length(current_setting('provision.app_password')) < 24 OR length(current_setting('provision.migration_password')) < 24 THEN
    RAISE EXCEPTION 'passwords must have at least 24 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = db)
     OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN (db || '_app', db || '_migration')) THEN
    RAISE EXCEPTION 'database % or its logins already exist; nothing was changed', db;
  END IF;
END;
$$;

-- Logins. No inheritance, no role attributes: each one only has what is granted below.
SELECT format('CREATE ROLE %I LOGIN NOINHERIT PASSWORD %L', :'migration', :'migration_password') \gexec
SELECT format('CREATE ROLE %I LOGIN NOINHERIT PASSWORD %L', :'app', :'app_password') \gexec
SELECT set_config('provision.app_password', '', false), set_config('provision.migration_password', '', false) \gset discard_

-- The database belongs to the administrator; nobody else may connect unless granted.
SELECT format('CREATE DATABASE %I ENCODING ''UTF8'' TEMPLATE template0', :'database') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'database') \gexec
SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I, %I', :'database', :'app', :'migration') \gexec
-- Prisma's first migration runs `CREATE SCHEMA IF NOT EXISTS "public"`, which needs this right.
SELECT format('GRANT CREATE ON DATABASE %I TO %I', :'database', :'migration') \gexec

\connect :database
\set ON_ERROR_STOP on
-- The migration login owns the schema: it creates, alters and drops tables in this database only.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migration') \gexec
-- The application login reads and writes the rows of every table the migration login creates.
-- The first migration takes back its rights on audit_event and on the migration history.
SELECT format('GRANT USAGE ON SCHEMA public TO %I', :'app') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', :'migration', :'app') \gexec
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I', :'migration', :'app') \gexec
