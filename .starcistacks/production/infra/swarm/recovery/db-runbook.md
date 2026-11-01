# Database runbook: self-hosted PostgreSQL (`db`)

Owner ruling 2026-10-29: production runs on its own PostgreSQL and no earlier data is carried over. The database starts CLEAN from `db/bootstrap.sql`, then
the migrations of `db/migrations/`. No secret is printed anywhere below; the age identity is loaded in memory only by
`bash D:/starci-tmp/nivo-demo/bin/with-age.sh`. A decrypted dump lives in a scratch directory outside every repository and is deleted afterwards.

## 1. First start of a clean database

1. Seal the `postgres` member (declared, not sealed yet): `POSTGRES_PASSWORD` and `APP_BE_DB_PASSWORD` (`starci app secret set production postgres <KEY>`).
2. Deploy the stack (the **deploy stack** workflow). `db` initialises its cluster on the empty volume `nivo-engine_postgres-data` with the sealed superuser password; the api and mcp stay unhealthy until step 4 (no `app_be`, no schema).
3. Open the loopback relay and run the bootstrap **as the image superuser**, then the migrations as `postgres`:

   ```bash
   # on the manager: a loopback-only relay on the private network (no published port), forwarded to the owner machine over ssh
   docker run -d --rm --name nivo-tunnel-pg --network nivo_agents -p 127.0.0.1:55432:5432 alpine/socat tcp-listen:5432,fork,reuseaddr tcp-connect:db:5432
   # owner machine (values loaded in memory by the harness, never typed):
   psql "$DATABASE_URL_ADMIN" -v ON_ERROR_STOP=1 -f db/bootstrap.sql         # postgres, once, idempotent
   starci app db migrate --env production --db-url-env DATABASE_URL --execute  # postgres, forward-only
   ```

   `DATABASE_URL` = host 127.0.0.1, port 55432, database `postgres`, user `postgres` with the sealed `POSTGRES_PASSWORD` as its password (a standard PostgreSQL URL); `DATABASE_URL_ADMIN` is the same URL (the image superuser is `postgres`). Both exist only in the operator shell.
4. Set the application role and seal the connection: `alter role app_be with password '<APP_BE_DB_PASSWORD>'` (the baseline creates `app_be` LOGIN, NOINHERIT, NOBYPASSRLS without a password), then seal
   `PRIMARY_DB_URL` = `postgresql://app_be@db:5432/postgres` in the `api` member and deploy again.
5. `starci app stack verify --env production`. Close the relay: `docker rm -f nivo-tunnel-pg`.

### Applied files edited for the clean start (2026-10-29, commit 7a40edd5d)

By owner decision, nine applied migrations were edited in place instead of squashed: `CREATE EXTENSION pg_cron/pg_net`, the
realtime publication and every `cron.schedule`/`cron.unschedule` were removed, because the app no longer uses them (ticks run in
platform/jobs, realtime is the app's own listener). The earlier versions of those files already ran on dev and rehearsal databases, which
still carry the cron jobs, both extensions and the publication; `db migrate` compares versions only, so it reports nothing to do there.
Reset such a database on the managed image (`npm run db:reset`, then migrate) to match production.

### What `db/bootstrap.sql` provides (and why)

The applied migrations were written against an `auth` and a `storage` schema (users, identities, sessions, `auth.uid()`, `auth.jwt()`, buckets and objects) and the browser roles. The official postgres image has none of them.
The lite edition runs neither service (auth is the app's own, storage is MinIO), so the bootstrap creates exactly what the migrations reference, empty:

| Object | Used by |
| --- | --- |
| roles `anon`, `authenticated`, `service_role` (if absent) | ~1800 GRANTs and policies |
| `auth.users` (full GoTrue column set, extended in place), `auth.identities`, `auth.sessions` | 33 FKs and the `be_account_*` functions, `last_sign_in_at`, `raw_user_meta_data` in the avatar views |
| `auth.uid()`, `auth.role()`, `auth.jwt()` | 72 + 3 + 6 policy and function calls; they read `request.jwt.claims` and return NULL when it is unset, as the API (role `app_be`) never sets it |
| `storage.buckets`, `storage.objects` (RLS on) | the bucket seeds and the `objects_*` policies |
| schema `extensions` | `pgcrypto`, `unaccent`, `vector` are created `WITH SCHEMA extensions` |

Extensions `vector` and `pgmq` come from the managed image `.starcistacks/images/db/Dockerfile` (official postgres 17 with pgvector and pgmq); pg_cron and pg_net are not used: scheduled work runs as app CLI jobs.

## 2. First start

Production starts on an empty database: the first deploy (`--first-start`) runs `db/bootstrap.sql` and every migration in order as the superuser, then the app connects as `app_be`.

## 3. Backups and restore

`nivo-postgres-backup` writes `nivo-db-<UTC stamp>.dump.age` (+ `.sha256`) to the volume `nivo-engine_postgres-backups` at 02:00 Asia/Ho_Chi_Minh and at start when none is younger than 26 h: `pg_dump --format=custom`, age-encrypted to the recipient of `.sops.yaml`, files older than 14 days deleted.
It fails loudly (non-zero, no `.age` file left) when `pg_dump` fails. Copy the files off the VPS.

Restore into a fresh `db` (empty volume; run step 1.1 to 1.2 first, keep the api and mcp scaled to 0: `docker service scale nivo_nivo-api=0 nivo_nivo-mcp=0`):

```bash
# 1. the file off the VPS, then on the owner machine, scratch OUTSIDE every repository
(cd <dir> && sha256sum -c nivo-db-<stamp>.dump.age.sha256)
bash D:/starci-tmp/nivo-demo/bin/with-age.sh bash -c 'printf "%s\n" "$SOPS_AGE_KEY" | age -d -i - -o <scratch>/r.dump <dir>/nivo-db-<stamp>.dump.age'
# 2. stream it into the container (the identity and the plain dump never touch the VPS; resolve the id with DOCKER_HOST=ssh://nivo@<vps>)
export DOCKER_HOST=ssh://nivo@<vps>; C=$(docker ps -q -f name=nivo_db.)
docker cp <scratch>/r.dump $C:/tmp/r.dump
docker exec $C pg_restore -U postgres -h 127.0.0.1 -d postgres --clean --if-exists --no-owner --exit-on-error /tmp/r.dump
docker exec $C rm /tmp/r.dump
# 3. as 1.4: app_be password (roles are not in a per-database dump), scale the api and mcp back, starci app stack verify
rm -rf <scratch>
```

Rehearsed locally with a throwaway age key: `backup.sh` (`BACKUP_RUN_ONCE=1`) against a fresh container, checksum verified, decrypted and restored with the command above into a second fresh container with `--exit-on-error` (no error), table content identical (same md5 over 1000 rows); retention removed a 20-day-old file; a wrong password failed with no `.age` left.
