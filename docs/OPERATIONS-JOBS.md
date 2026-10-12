# Operating the job system

Design and handler contracts are in `docs/JOBS.md`. This page is the operator's side: deploy, look at failures, retry or drain, recover from a wiped Redis.

Shape in one paragraph: the web app writes a row to the Postgres **outbox** (source of truth). A relay in the engine reads unrelayed rows and adds them to **BullMQ** queues in **Redis**. BullMQ workers in the engine run the knowledge handlers (read, extract, embed). Redis only holds the queue state; losing it loses no work.

## Deploy

The engine ships through `.github/workflows/engine-deploy.yml` (environment `production`), on push to `main` touching `engine/**`, `supabase/migrations/**` or `src/lib/knowledge/pure/**`, or by hand (Actions > Deploy engine > Run workflow).

What it does, in order:

1. `npm ci` and `npm run build` in `engine/` (typecheck gate).
2. Compose guard: `docker-compose.yml` must have a `redis` service with a named volume, otherwise the run fails before touching the VPS.
3. Uploads `engine/` over SSH to `~/nivo-engine.new` and writes `deploy/.env` from the `ENGINE_ENV` secret (mode 600).
4. Swaps folders (the old release stays as `~/nivo-engine.prev`), builds the engine image on the VPS, starts `redis`, then `docker compose up -d`.
5. Health: engine container `healthy`, `redis-cli ping` = PONG, and `/readyz` returns 200 (it includes the Redis/BullMQ probe).
6. Unhealthy: logs are printed, the previous release is restored and rebuilt, and the run is marked failed. Healthy: the watchdog cron line is (re)installed.

A manual deploy without GitHub is still `DEPLOY_HOST=user@host engine/deploy/deploy.sh` (see `engine/deploy/README.md`).

Redis data lives in the compose volume `redis-data` (AOF on). Deploys never remove volumes. **Redis is not in `backup.sh` on purpose**: the outbox in Postgres is the source of truth.

### Secrets and variables to set before the first engine deploy

GitHub environment `production`:

| Kind | Name | Notes |
| --- | --- | --- |
| var | `VPS_HOST`, `VPS_USER` | same as the web deploy |
| secret | `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | same as the web deploy (CI deploy key, pinned host keys) |
| secret | `ENGINE_ENV` | the whole `deploy/.env`; push it with `node scripts/env-sync.mjs` (reads the `[engine]` block of `secrets.env`) |

`ENGINE_ENV` must include, besides the existing engine variables: `REDIS_URL` (default `redis://redis:6379`), `OPENROUTER_API_KEY`, `EMBEDDING_MODEL` (and optionally `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY` (must equal the web app's value, it decrypts stored Drive tokens), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Optional watchdog thresholds: `JOBS_FAILED_ALERT` (20), `OUTBOX_STALE_SECONDS` (300). `env-sync` fills the knowledge keys from the `[app]` block when `[engine]` leaves them empty and warns (names only) about anything still missing.

## Watch

`engine/deploy/watchdog.sh` runs every minute from the `nivo` crontab and writes `~/nivo-engine/watchdog.log`. Besides the existing engine/OpenClaw coupling check it now:

- starts the `redis` container again when it is down, and logs `ALERT redis-down` / `ALERT redis-ping`;
- logs `ALERT failed-jobs` when the failed BullMQ jobs, summed over all queues, exceed `JOBS_FAILED_ALERT`;
- logs `ALERT outbox-stale` when the engine `/healthz` JSON reports an unrelayed outbox row older than `OUTBOX_STALE_SECONDS`. The probe reads the numeric fields under `outbox` whose name contains `oldest`, `lag` or `age` (seconds).

Each kind alerts at most once per 30 minutes. Alerts are log lines, the same channel as today's `recreating engine` entries: `grep ALERT ~/nivo-engine/watchdog.log`.

## Read failed jobs

On the VPS, in `~/nivo-engine/deploy`:

```bash
./jobs.sh queues                  # waiting / active / delayed / failed / completed per queue
./jobs.sh failed knowledge        # last 20 failed jobs: id | name | attempts | reason (no payload)
./jobs.sh failed knowledge 100
```

Raw redis-cli equivalents:

```bash
docker compose --env-file .env exec redis redis-cli --scan --pattern 'bull:*:failed'
docker compose --env-file .env exec redis redis-cli zrevrange bull:<queue>:failed 0 9
docker compose --env-file .env exec redis redis-cli hgetall bull:<queue>:<jobId>
```

The engine log has the handler error with the job id: `docker compose --env-file .env logs --tail 200 engine | grep <jobId>`.

There is no `GET /admin/jobs/failed` endpoint: the engine has no admin auth guard to reuse (its only guards are the per-workspace signed tool tokens and the HMAC for n8n), and a new one is not worth a second door into the VPS. Use `jobs.sh`.

## Retry and drain

```bash
./jobs.sh retry <queue>           # all failed jobs back to waiting
./jobs.sh drain <queue>           # delete waiting + delayed jobs (active jobs finish, failed stay)
./jobs.sh clean-failed <queue>    # delete failed jobs once you have read them
```

All three are safe: handlers are idempotent and the outbox still holds the row, so a drained job is re-sent by the relay when its row is still unrelayed, and a retried job that already succeeded once is a no-op. Fix the cause first (a bad key, a revoked Drive grant, a provider outage), then retry; retrying into the same error only refills `failed`.

## Redis was wiped (volume lost, `FLUSHALL`, new host)

Nothing is lost: pending work exists as unrelayed outbox rows in Postgres.

1. `docker compose --env-file .env up -d redis` (a fresh empty volume is fine), then `./jobs.sh ping` should say PONG and `appendonly yes`.
2. Restart the engine so the BullMQ workers and the relay reconnect: `docker compose --env-file .env up -d --force-recreate engine`.
3. The relay re-sends every outbox row that is not marked relayed. Rows whose job was already in Redis but not finished come back too; handlers de-duplicate (idempotent), so duplicates are harmless.
4. Check: `./jobs.sh queues` shows the waiting count falling, and `ALERT outbox-stale` stops appearing in the watchdog log.

Rows marked relayed whose job died with Redis before it ran are the one case the relay does not see on its own. If a document stays stuck in "processing" after recovery, re-queue it from the app (re-process the source) or reset the outbox rows' `relayed_at` for that workspace as described in `docs/JOBS.md`.

## Local development

```bash
npm run db:start        # local Supabase, put its URL and service key in secrets.env
npm run dev:stack       # Redis (docker, 127.0.0.1:56379) + engine in watch mode, env generated from secrets.env
npm run dev:stack:down  # remove the Redis container (volume kept)
```

`engine/dev/stack.mjs --env` lists the variable names it would pass to the engine. It refuses a non-local `NEXT_PUBLIC_SUPABASE_URL`. Run `npm ci` in `engine/` first (the root `node_modules` is shared; do not install at the root).
