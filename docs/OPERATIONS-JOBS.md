# Operating the job system

Design and handler contracts are in `docs/JOBS.md`. This page is the operator's side: deploy, look at failures, retry, recover.

Shape in one paragraph: the web app (or an RPC) writes the business row, a `job_outbox` row and a **pgmq** message in ONE Postgres
transaction, in the app's own Supabase. The engine polls the queue (`job_read`), runs the knowledge handlers (read, extract, embed) and acks,
retries or archives each message. There is no queue service to run: Supabase holds the queues and backs them up with the database.

## Deploy

The engine ships through `.github/workflows/engine-deploy.yml` (environment `production`), on push to `main` touching `engine/**`,
`supabase/migrations/**` or `src/lib/knowledge/pure/**`, or by hand (Actions > Deploy engine > Run workflow).

Order matters once: **apply the migrations to Supabase before the engine deploy** (`20261025100000_job_outbox.sql`, then
`20261025110000_pgmq_transport.sql`, which enables `pgmq` and creates the queue `knowledge`). An engine without the job RPCs is not ready
(`/readyz` 503) and the deploy rolls back.

What the workflow does, in order:

1. `npm ci` and `npm run build` in `engine/` (typecheck gate).
2. Uploads `engine/` over SSH to `~/nivo-engine.new` and writes `deploy/.env` from the `ENGINE_ENV` secret (mode 600).
3. Swaps folders (the old release stays as `~/nivo-engine.prev`), builds the engine image on the VPS, `docker compose up -d --remove-orphans`
   (this also removes a `redis` container left by an earlier release; its volume is kept and can be deleted by hand).
4. Health: engine container `healthy` and `/readyz` returns 200 (engine_jobs poll + pgmq reachable).
5. Unhealthy: logs are printed, the previous release is restored and rebuilt, and the run is marked failed. Healthy: the watchdog cron line is (re)installed.

A manual deploy without GitHub is still `DEPLOY_HOST=user@host engine/deploy/deploy.sh` (see `engine/deploy/README.md`).

### Secrets and variables to set before the first engine deploy

GitHub environment `production`:

| Kind | Name | Notes |
| --- | --- | --- |
| var | `VPS_HOST`, `VPS_USER` | same as the web deploy |
| secret | `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | same as the web deploy (CI deploy key, pinned host keys) |
| secret | `ENGINE_ENV` | the whole `deploy/.env`; push it with `node scripts/env-sync.mjs` (reads the `[engine]` block of `secrets.env`) |

`ENGINE_ENV` must include, besides the existing engine variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`,
`EMBEDDING_MODEL` (and optionally `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`), `CHANNEL_TOKEN_KEY` (must equal the web app's value, it
decrypts stored Drive tokens), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Optional: `JOBS_CONCURRENCY` (4),
`JOBS_WORKSPACE_CONCURRENCY` (2), watchdog thresholds `JOBS_FAILED_ALERT` (20) and `JOBS_STALE_SECONDS` (300). `env-sync` fills the
knowledge keys from the `[app]` block when `[engine]` leaves them empty and warns (names only) about anything still missing.

## Watch

`engine/deploy/watchdog.sh` runs every minute from the `nivo` crontab and writes `~/nivo-engine/watchdog.log`. Besides the engine/OpenClaw
coupling check it reads the engine `/healthz` JSON (`jobs.stats`, which is `job_stats()` in Postgres) and:

- logs `ALERT failed-jobs` when more than `JOBS_FAILED_ALERT` jobs failed in the last 24 h;
- logs `ALERT jobs-stale` when a job has been queued longer than `JOBS_STALE_SECONDS` (the engine is not consuming, or a workspace is
  saturated).

Each kind alerts at most once per 30 minutes. Alerts are log lines, the same channel as the `recreating engine` entries:
`grep ALERT ~/nivo-engine/watchdog.log`.

## Read failed jobs

On the VPS, in `~/nivo-engine/deploy` (it runs through the engine container's Supabase client):

```bash
./jobs.sh stats            # job_stats(): depth and oldest age per queue, running, failed in 24 h, oldest queued
./jobs.sh failed           # last 20 failed jobs: outbox id | name | attempts | finished_at | last_error (no payload)
./jobs.sh failed 100
./jobs.sh open             # the oldest queued / running jobs
```

The same from the Supabase SQL editor:

```sql
select public.job_stats();
select id, name, attempts, finished_at, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;
select msg_id, read_ct, archived_at, message->>'name', message->>'dedupe' from pgmq.a_knowledge order by archived_at desc limit 20;
```

The engine log has the handler error with the dedupe key: `docker compose --env-file .env logs --tail 200 engine | grep '<dedupe key>'`.

There is no `GET /admin/jobs/failed` endpoint: the engine has no admin auth guard to reuse, and the SQL above needs none.

## Retry

```bash
./jobs.sh retry <outbox-id>      # send one failed job again (job_requeue: new message, attempts reset)
./jobs.sh retry-failed [hours]   # every job that failed in the last <hours> (default 24)
```

Safe: handlers are idempotent, so a retried job whose subject is already done is a no-op. Fix the cause first (a bad key, a revoked Drive
grant, a provider outage), then retry; retrying into the same error only fails again. A document the owner sees as failed is better retried
the owner's way (`select knowledge_retry_source('<sourceId>')` or the Thử lại button), which also resets its status.

To stop consuming without losing anything: `JOBS_ENABLED=0` in `deploy/.env`, recreate the engine; messages wait in the queue.

## A stuck job

- A message whose engine died stays invisible for at most `JOBS_VT_SECONDS` (60 s), then comes back with one more attempt.
- A workspace slot of a dead engine frees itself with its lease (same 60 s).
- An outbox row in `running` for long, with no message in `pgmq.q_knowledge`: the ack was lost after the message was deleted. Harmless;
  mark it `done` by hand if it bothers the stale alert.

## Local development

```bash
npm run db:start        # local Supabase (pgmq ships in the image); put its URL and service key in secrets.env
npm run dev:stack       # engine in watch mode against the local stack, env generated from secrets.env (or NIVO_SECRETS=<file>)
```

`ENGINE_WORKER_ENABLED=0 npm run dev:stack` keeps the old `engine_jobs` worker off (it would call OpenClaw and channel APIs for queued rows);
`DEV_ENGINE_PORT=<port>` moves the engine off 8787. `engine/dev/stack.mjs --env` lists the variable names it would pass to the engine. It
refuses a non-local `NEXT_PUBLIC_SUPABASE_URL`. Run `npm ci` in `engine/` first (the root `node_modules` is shared; do not install at the root).
