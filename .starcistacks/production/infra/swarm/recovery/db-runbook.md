# Database runbook: self-hosted PostgreSQL (`nivo-postgres`)

Owner ruling 2026-10-29: production leaves Supabase cloud and its data is NOT carried over. The database starts CLEAN from `db/bootstrap.sql`, then
the migrations of `db/migrations/`. No secret is printed anywhere below; the age identity is loaded in memory only by
`bash D:/starci-tmp/nivo-demo/bin/with-age.sh`. A decrypted dump lives in a scratch directory outside every repository and is deleted afterwards.

## 1. First start of a clean database

1. Seal the `postgres` member (declared, not sealed yet): `POSTGRES_PASSWORD` and `APP_BE_DB_PASSWORD` (`starci app secret set production postgres <KEY>`).
2. Deploy the stack (the **deploy stack** workflow). `nivo-postgres` initialises its cluster on the empty volume `nivo-engine_postgres-data` with the sealed superuser password; the api and mcp stay unhealthy until step 4 (no `app_be`, no schema).
3. Open the loopback relay and run the bootstrap **as the image superuser**, then the migrations as `postgres`:

   ```bash
   # on the manager: a loopback-only relay on the private network (no published port), forwarded to the owner machine over ssh
   docker run -d --rm --name nivo-tunnel-pg --network nivo_agents -p 127.0.0.1:55432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:nivo-postgres:5432
   # owner machine (values loaded in memory by the harness, never typed):
   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f db/bootstrap.sql         # supabase_admin, once, idempotent
   starci app db migrate --env production --db-url-env DATABASE_URL --execute  # postgres, forward-only
   ```

   `DATABASE_URL` = host 127.0.0.1, port 55432, database `postgres`, user `postgres` with the sealed `POSTGRES_PASSWORD` as its password (a standard PostgreSQL URL); `DATABASE_URL_ADMIN` is the same with user `supabase_admin`. Both exist only in the operator shell.
4. Set the application role and seal the connection: `alter role app_be with password '<APP_BE_DB_PASSWORD>'` (the baseline creates `app_be` LOGIN, NOINHERIT, NOBYPASSRLS without a password), then seal
   `PRIMARY_DB_URL` = `postgresql://app_be@nivo-postgres:5432/postgres` in the `api` member and deploy again.
5. `select count(*) from cron.job` is 12 (the migrations schedule them). `starci app stack verify --env production`. Close the relay: `docker rm -f nivo-tunnel-pg`.

### What `db/bootstrap.sql` provides (and why)

The applied migrations were written for Supabase and call objects GoTrue and Supabase Storage created. The `supabase/postgres` image ships only a partial, old-shaped copy of them (no `auth.identities`, `auth.sessions`, `auth.jwt()`, no storage tables).
The lite edition runs neither service (auth is the app's own, storage is MinIO), so the bootstrap creates exactly what the migrations reference, empty:

| Object | Used by |
| --- | --- |
| roles `anon`, `authenticated`, `service_role` (if absent) | ~1800 GRANTs and policies |
| `auth.users` (full GoTrue column set, extended in place), `auth.identities`, `auth.sessions` | 33 FKs and the `be_account_*` functions, `last_sign_in_at`, `raw_user_meta_data` in the avatar views |
| `auth.uid()`, `auth.role()`, `auth.jwt()` | 72 + 3 + 6 policy and function calls; they read `request.jwt.claims` and return NULL when it is unset, as the API (role `app_be`) never sets it |
| `storage.buckets`, `storage.objects` (RLS on) | the bucket seeds and the `objects_*` policies |
| publication `supabase_realtime` | `alter publication ... add table` in the baseline |
| schema `extensions` | `pgcrypto`, `unaccent`, `vector` are created `WITH SCHEMA extensions` |

Extensions `pg_cron`, `pg_net` and `pgmq` come from the image with `shared_preload_libraries` and `cron.database_name` set explicitly in the stack.

## 2. Rehearsal (local, throwaway)

`bash scripts/integration/selfhost-db-rehearsal.sh [port]` starts a fresh `supabase/postgres:17.11.0.006@sha256:c141fd17...` container on a free local port (default 55432), runs `db/bootstrap.sql`, then every migration in order (each in its own transaction, as `postgres`), prints the summary and deletes the container.
Recorded 2026-10-29: bootstrap OK, **52 of 52 migrations applied with zero errors**, 179 public tables, 12 cron jobs, extensions pg_cron/pg_net/pgcrypto/pgmq/unaccent/vector, `app_be` LOGIN and NOBYPASSRLS. Run it again whenever a migration or the image digest changes.

## 3. Backups and restore

`nivo-postgres-backup` writes `nivo-db-<UTC stamp>.dump.age` (+ `.sha256`) to the volume `nivo-engine_postgres-backups` at 02:00 Asia/Ho_Chi_Minh and at start when none is younger than 26 h: `pg_dump --format=custom`, age-encrypted to the recipient of `.sops.yaml`, files older than 14 days deleted.
It fails loudly (non-zero, no `.age` file left) when `pg_dump` fails. Copy the files off the VPS.

Restore into a fresh `nivo-postgres` (empty volume; run step 1.1 to 1.2 first, keep the api and mcp scaled to 0: `docker service scale nivo_nivo-api=0 nivo_nivo-mcp=0`):

```bash
# 1. the file off the VPS, then on the owner machine, scratch OUTSIDE every repository
(cd <dir> && sha256sum -c nivo-db-<stamp>.dump.age.sha256)
bash D:/starci-tmp/nivo-demo/bin/with-age.sh bash -c 'printf "%s\n" "$SOPS_AGE_KEY" | age -d -i - -o <scratch>/r.dump <dir>/nivo-db-<stamp>.dump.age'
# 2. stream it into the container (the identity and the plain dump never touch the VPS; resolve the id with DOCKER_HOST=ssh://nivo@<vps>)
export DOCKER_HOST=ssh://nivo@103.142.27.9; C=$(docker ps -q -f name=nivo_nivo-postgres.)
docker cp <scratch>/r.dump $C:/tmp/r.dump
docker exec $C pg_restore -U supabase_admin -h 127.0.0.1 -d postgres --clean --if-exists --no-owner --exit-on-error /tmp/r.dump
docker exec $C rm /tmp/r.dump
# 3. as 1.4: app_be password (roles are not in a per-database dump), scale the api and mcp back, starci app stack verify
rm -rf <scratch>
```

Rehearsed locally with a throwaway age key: `backup.sh` (`BACKUP_RUN_ONCE=1`) against a fresh container, checksum verified, decrypted and restored with the command above into a second fresh container with `--exit-on-error` (no error), table content identical (same md5 over 1000 rows); retention removed a 20-day-old file; a wrong password failed with no `.age` left.
