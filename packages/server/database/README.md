# Provisioning a system's database

One procedure per supported engine (ADR-0016) creates, for one system and one environment:

| What | PostgreSQL | SQL Server |
|---|---|---|
| Database | `<system>_<environment>` (hyphens become underscores) | same |
| Application login | `<database>_app`: rows of schema `public`, no DDL | login `<database>_app`, user `[app]`: rows of schema `dbo`, no DDL |
| Migration login | `<database>_migration`: owner of schema `public` of that database only | login `<database>_migration`, user `[migration]`: `CONTROL` on schema `dbo` and `CREATE TABLE`/`VIEW`/`PROCEDURE`/`FUNCTION`/`TYPE` in that database only |

The first migration of every system (written by `solidvs-data migration`) then makes `audit_event`
insert-only for every login, and takes back from the application login any right on the
migration history.

The laboratory (`solidvs-data lab`, `lab/lab.ts`) runs the same files; only the client runs inside
a container there.

## Running it on a real server

Who: a platform administrator, with a database account that may create logins and databases
(PostgreSQL: superuser or `CREATEROLE` and `CREATEDB`; SQL Server: `sysadmin`, or `securityadmin`
plus `dbcreator`). Client: `psql` 15 or later, or `sqlcmd`.

```sh
# PostgreSQL: connection from the client's own variables, never from arguments
export PGHOST=db.internal PGUSER=platform_admin PGSSLMODE=verify-full PGSSLROOTCERT=/path/ca.pem
read -rs PGPASSWORD && export PGPASSWORD
sh node_modules/@solidvs/server/database/provision.sh postgresql orders staging > /dev/tty

# SQL Server
export SQLCMDSERVER=sql.internal SQLCMDUSER=platform_admin
read -rs SQLCMDPASSWORD && export SQLCMDPASSWORD
SQLCMD="sqlcmd -N" sh node_modules/@solidvs/server/database/provision.sh sqlserver orders staging > /dev/tty
```

The script prints the two generated passwords once, as JSON. Store them right away as secrets of
the platform repository's GitHub environment `<system>-<environment>`:

- `DATABASE_USER` and `DATABASE_PASSWORD`: the application login (delivered to the service);
- `MIGRATION_DATABASE_USER` and `MIGRATION_DATABASE_PASSWORD`: the migration login (delivered to
  the migration step only).

Keep no copy. Running it again for the same system and environment stops before changing anything.

Notes:

- The `CREATE ROLE`/`CREATE LOGIN` statements carry the passwords: keep statement logging and
  traces off while it runs.
- On SQL Server, the migration login can still `TRUNCATE audit_event` (it has `ALTER` on the
  schema). It is used only by the deploy step, for reviewed migrations.
- Removing a system's database is a manual, reviewed operation; there is no script for it.
