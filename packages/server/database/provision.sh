#!/bin/sh
# Creates one system's database and its two logins (ADR-0016), on PostgreSQL or SQL Server.
#
#   database/provision.sh <postgresql|sqlserver> <system> <environment>
#
# The administrator's connection comes from the engine client's own environment variables, never
# from arguments:
#   PostgreSQL: PGHOST, PGPORT, PGUSER and PGPASSWORD (or ~/.pgpass); PGSSLMODE=verify-full with
#               PGSSLROOTCERT for a server certificate from an internal authority.
#   SQL Server: SQLCMDSERVER, SQLCMDUSER and SQLCMDPASSWORD (or integrated authentication).
# PSQL and SQLCMD replace the client command (for example to run it inside a container).
#
# The two passwords are generated here and printed once, as JSON, on standard output. Store each
# one as a secret of the system's GitHub environment (the application login in the system's
# environment, the migration login only where the migration step reads it) and keep no copy.
set -eu

usage() { echo "usage: $0 <postgresql|sqlserver> <system> <environment>" >&2; exit 2; }
[ $# -eq 3 ] || usage
engine=$1
# System ids use hyphens (catalog); database names use underscores.
SYSTEM=$(printf '%s' "$2" | tr '-' '_')
ENVIRONMENT=$3
here=$(cd "$(dirname "$0")" && pwd)

# 32 characters from a CSPRNG, with upper case, lower case and digits (SQL Server password policy).
password() {
  while :; do
    candidate=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-32)
    case $candidate in *[A-Z]*) ;; *) continue ;; esac
    case $candidate in *[a-z]*) ;; *) continue ;; esac
    case $candidate in *[0-9]*) ;; *) continue ;; esac
    [ ${#candidate} -eq 32 ] && { printf '%s' "$candidate"; return; }
  done
}

APP_PASSWORD=$(password)
MIGRATION_PASSWORD=$(password)
export SYSTEM ENVIRONMENT APP_PASSWORD MIGRATION_PASSWORD

case $engine in
  postgresql) ${PSQL:-psql} --no-psqlrc --quiet --set ON_ERROR_STOP=1 --dbname postgres -f - < "$here/provision/postgresql.sql" >&2 ;;
  sqlserver) ${SQLCMD:-sqlcmd} -b < "$here/provision/sqlserver.sql" >&2 ;;
  *) usage ;;
esac

database="${SYSTEM}_${ENVIRONMENT}"
printf '{"engine":"%s","database":"%s","application":{"user":"%s","password":"%s"},"migration":{"user":"%s","password":"%s"}}\n' \
  "$engine" "$database" "${database}_app" "$APP_PASSWORD" "${database}_migration" "$MIGRATION_PASSWORD"
