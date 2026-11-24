-- Provisioning of one system's database on SQL Server (ADR-0016). Normally run through
-- `database/provision.sh` (shipped in @solidvs/server), which generates the passwords; sqlcmd reads, from the environment:
--   SYSTEM, ENVIRONMENT       e.g. orders, staging → database orders_staging
--   APP_PASSWORD              login <database>_app, user [app]: data only, no DDL
--   MIGRATION_PASSWORD        login <database>_migration, user [migration]: DDL in schema dbo of
--                             this database only
-- Run as a platform administrator (sysadmin, or securityadmin plus dbcreator). Inside every
-- system database the two users have the same names, so migrations can refer to [app].
:on error exit
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @database sysname = N'$(SYSTEM)_$(ENVIRONMENT)';
DECLARE @app sysname = @database + N'_app';
DECLARE @migration sysname = @database + N'_migration';
DECLARE @app_password nvarchar(128) = N'$(APP_PASSWORD)';
DECLARE @migration_password nvarchar(128) = N'$(MIGRATION_PASSWORD)';

-- Checks before anything is created: names, password strength, and nothing left from before.
IF PATINDEX(N'%[^a-z0-9_]%', @database COLLATE Latin1_General_BIN) > 0 OR LEN(@database) > 50
    OR LEFT(@database, 1) COLLATE Latin1_General_BIN NOT LIKE N'[a-z]'
BEGIN;
    THROW 50000, N'system and environment: lowercase letters, digits and underscores', 1;
END;
IF LEN(@app_password) < 24 OR LEN(@migration_password) < 24
    OR CHARINDEX(N'''', @app_password + @migration_password) > 0
BEGIN;
    THROW 50000, N'passwords must have at least 24 characters and no quotes', 1;
END;
IF DB_ID(@database) IS NOT NULL OR SUSER_ID(@app) IS NOT NULL OR SUSER_ID(@migration) IS NOT NULL
BEGIN;
    THROW 50000, N'the database or its logins already exist; nothing was changed', 1;
END;

DECLARE @sql nvarchar(max);

-- EXEC (...) takes literals and variables only: every statement is built in @sql first.
SET @sql = N'CREATE DATABASE ' + QUOTENAME(@database) + N';';
EXEC (@sql);

SET @sql = N'CREATE LOGIN ' + QUOTENAME(@migration) + N' WITH PASSWORD = ' + QUOTENAME(@migration_password, N'''')
    + N', DEFAULT_DATABASE = ' + QUOTENAME(@database) + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;'
    + N' CREATE LOGIN ' + QUOTENAME(@app) + N' WITH PASSWORD = ' + QUOTENAME(@app_password, N'''')
    + N', DEFAULT_DATABASE = ' + QUOTENAME(@database) + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;';
EXEC (@sql);

SET @sql = N'USE ' + QUOTENAME(@database) + N';
CREATE USER [migration] FOR LOGIN ' + QUOTENAME(@migration) + N' WITH DEFAULT_SCHEMA = [dbo];
CREATE USER [app] FOR LOGIN ' + QUOTENAME(@app) + N' WITH DEFAULT_SCHEMA = [dbo];
-- Migration user: creates and changes objects in schema dbo, and grants or denies rights on them
-- (the first migration denies [app] any change to audit_event and to the migration history).
GRANT CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION, CREATE TYPE TO [migration];
GRANT CONTROL ON SCHEMA::[dbo] TO [migration];
-- Application user: rows of schema dbo only.
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::[dbo] TO [app];';
EXEC (@sql);

PRINT N'Provisioned ' + @database;
