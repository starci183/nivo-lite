# Operating the job system

Design and handler contracts are in `be/docs/guides/jobs.md`. This page is the operator's side: deploy, look at failures, retry, recover.

Shape in one paragraph: the web app (or an RPC) writes the business row, a `job_outbox` row and a **pgmq** message in ONE Postgres
transaction, in the app's own Supabase. The api's workers poll the queue, run the handlers (knowledge: read, extract, embed) and ack,
retry or archive each message. There is no queue service to run: Supabase holds the queues and backs them up with the database.

## Deploy

The api (and the OpenClaw and n8n stack around it) ships through `.github/workflows/api-deploy.yml` (environment `production`), by hand only:
Actions > Deploy api > Run workflow. The cutover order and the one-time steps are in `be/docs/runbooks/cutover.md`; the stack itself is described
in `be/docs/runbooks/vps-stack.md`.

Order matters: **apply the migrations to Supabase before the api deploy** (`supabase db push`, or the database deploy workflow). An api without
the queue objects of the platform migration is not ready and the deploy rolls back.

What the workflow does, in order:

1. Builds the api image on the runner from `be/apps/api/Dockerfile` (this runs the build and the type gate) and ships it with `docker save | ssh docker load`.
2. Uploads `deploy/stack/` to `~/nivo-engine.new/deploy`, writes `deploy/.env` from the `ENGINE_ENV` secret plus `API_TAG=<sha>`, and `deploy/api.env`
   from the `API_ENV` secret (both mode 600).
3. Swaps folders (the old release stays as `~/nivo-engine.prev`), `docker compose up -d --remove-orphans` (this also removes a container of a service
   that left the stack, such as the old `engine`).
4. Health: the api container is `healthy` and `/readyz` returns 200 inside it.
5. Unhealthy: logs are printed, the previous release is restored, and the run is marked failed. Healthy: older images are pruned and the watchdog cron line is (re)installed.

### Secrets and variables to set before the first api deploy

GitHub environment `production`:

| Kind   | Name                             | Notes                                                                                                                                                      |
| ------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| var    | `VPS_HOST`, `VPS_USER`           | same as the web deploy                                                                                                                                     |
| secret | `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | same as the web deploy (CI deploy key, pinned host keys)                                                                                                   |
| secret | `ENGINE_ENV`                     | the stack `deploy/.env` (OpenClaw, n8n, binds, watchdog thresholds); push it with `node scripts/env-sync.mjs` (reads the `[stack]` block of `secrets.env`) |
| secret | `API_ENV`                        | the api runtime `deploy/api.env` (database role, Supabase, origins, provider and knowledge keys); the same script pushes it from the `[api]` block         |

`API_ENV` must include `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, and the
knowledge keys: `OPENROUTER_API_KEY`, `EMBEDDING_MODEL` (optionally `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`), `CHANNEL_TOKEN_KEY` (it decrypts stored Drive
tokens), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Optional tunables: `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`,
`JOBS_LEASE`. Watchdog thresholds live in the stack env: `JOBS_FAILED_ALERT` (20) and `JOBS_STALE_SECONDS` (300). `env-sync` fills the knowledge keys from the
`[app]` block when `[api]` leaves them empty and warns (names only) about anything still missing.

## Watch

`deploy/stack/watchdog.sh` runs every minute from the `nivo` crontab and writes `~/nivo-engine/watchdog.log`. Besides the api/OpenClaw coupling check
it asks `job_stats()` in Postgres (through the api container's own Supabase client) and:

- logs `ALERT failed-jobs` when more than `JOBS_FAILED_ALERT` jobs failed in the last 24 h;
- logs `ALERT jobs-stale` when a job has been queued longer than `JOBS_STALE_SECONDS` (the api is not consuming, or a workspace is saturated).

Each kind alerts at most once per 30 minutes. Alerts are log lines, the same channel as the `recreating api` entries:
`grep ALERT ~/nivo-engine/watchdog.log`.

## Read failed jobs

On the VPS, in `~/nivo-engine/deploy` (it runs through the api container's Supabase client):

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

The api log has the handler error with the dedupe key: `docker compose --env-file .env logs --tail 200 api | grep '<dedupe key>'`.

There is no `GET /admin/jobs/failed` endpoint: the SQL above needs no endpoint and no admin guard.

## Retry

```bash
./jobs.sh retry <outbox-id>      # send one failed job again (job_requeue: new message, attempts reset)
./jobs.sh retry-failed [hours]   # every job that failed in the last <hours> (default 24)
```

Safe: handlers are idempotent, so a retried job whose subject is already done is a no-op. Fix the cause first (a bad key, a revoked Drive
grant, a provider outage), then retry; retrying into the same error only fails again. A document the owner sees as failed is better retried
the owner's way (`select knowledge_retry_source('<sourceId>')` or the Retry button), which also resets its status.

To stop consuming without losing anything: the worker switch of the api (see the queue settings in `be/docs/guides/jobs.md`) in `deploy/api.env`, then recreate the api; messages wait in the queue.

## A stuck job

- A message whose worker died stays invisible for at most the visibility timeout (`QUEUE_VISIBILITY_TIMEOUT`), then comes back with one more attempt.
- A workspace slot of a dead worker frees itself with its lease (`JOBS_LEASE`).
- An outbox row in `running` for long, with no message in `pgmq.q_knowledge`: the ack was lost after the message was deleted. Harmless;
  mark it `done` by hand if it bothers the stale alert.

## Local development

```bash
npm run db:start        # local Supabase (pgmq ships in the image); put its URL and service key in secrets.env
npm run dev:be          # the api in watch mode (ts-node-dev) against the local stack, env from secrets.env (node scripts/with-secrets.mjs npm run dev:be)
```
