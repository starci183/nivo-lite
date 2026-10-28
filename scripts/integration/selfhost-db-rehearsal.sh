#!/usr/bin/env bash
# Proves db/bootstrap.sql + every db/migrations/*.sql on a throwaway supabase/postgres container, then deletes it.
# Usage: scripts/integration/selfhost-db-rehearsal.sh [host-port, default 55432]. Never touches production: it starts its own container.
set -euo pipefail
export MSYS_NO_PATHCONV=1
PORT="${1:-55432}"; NAME="selfhost-rehearsal-$PORT"
IMAGE="supabase/postgres:17.11.0.006@sha256:c141fd17ac6a76c4323e90b3aee8ff1a23d2e89e547c2b963cfadc309c079cc2"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cleanup() { if docker inspect "$NAME" >/dev/null 2>&1; then docker rm -f -v "$NAME" >/dev/null; fi; }
trap cleanup EXIT
docker run -d --name "$NAME" -p "127.0.0.1:$PORT:5432" -e POSTGRES_PASSWORD="$(openssl rand -hex 12)" "$IMAGE" \
  postgres -D /etc/postgresql -c cron.database_name=postgres >/dev/null
until docker exec "$NAME" pg_isready -q -U postgres -h 127.0.0.1; do sleep 3; done
sleep 20 # the image's own init scripts finish after the first ready signal
psqlc() { docker exec -i "$NAME" psql -h 127.0.0.1 -d postgres -q -v ON_ERROR_STOP=1 "$@"; }
echo "bootstrap"; psqlc -U supabase_admin -f - < "$ROOT/db/bootstrap.sql" >/dev/null 2>&1
n=0
for f in $(ls "$ROOT"/db/migrations/*.sql | sort); do
  n=$((n+1))
  psqlc -U postgres -1 -f - < "$f" >/dev/null 2>"/tmp/$NAME.err" || { echo "FAIL $(basename "$f")"; grep -A3 ERROR "/tmp/$NAME.err" | head; exit 1; }
done
echo "migrations applied: $n"
psqlc -U postgres -Atc "select 'public tables', count(*) from pg_tables where schemaname='public'" \
  -c "select 'cron jobs', count(*) from cron.job" \
  -c "select 'extensions', string_agg(extname, ',' order by extname) from pg_extension where extname in ('pg_cron','pg_net','pgmq','vector','unaccent','pgcrypto')" \
  -c "select 'app_be', rolcanlogin, rolbypassrls from pg_roles where rolname='app_be'"
