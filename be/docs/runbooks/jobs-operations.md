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
2. Decrypts the sealed files in the job (`deploy/materialize.mjs`, `SOPS_AGE_KEY`) and uploads `deploy/stack/` to `~/nivo-engine.new/deploy` with the per-key secret files, `api.env` (pointers), `openclaw.env` and `.env` (settings plus `API_TAG=<sha>`).
3. Swaps folders (the old release stays as `~/nivo-engine.prev`), `docker compose up -d --remove-orphans` (this also removes a container of a service
   that left the stack, such as the old `engine`).
4. Health: the api container is `healthy` and `/readyz` returns 200 inside it.
5. Unhealthy: logs are printed, the previous release is restored, and the run is marked failed. Healthy: older images are pruned and the watchdog cron line is (re)installed.

### Secrets and variables to set before the first api deploy

GitHub environment `production`:

| Kind   | Name                             | Notes                                                                                                          |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| var    | `VPS_HOST`, `VPS_USER`           | same as the web deploy                                                                                         |
| secret | `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | same as the web deploy (CI deploy key, pinned host keys)                                                       |
| secret | `SOPS_AGE_KEY`                   | the age identity of `.sops.yaml`; the only way the application secrets reach the job (protect the environment) |

The application secrets are in `.starcistacks/production/secrets/{api,auth,stack}.enc`; names and meaning are in `deploy/stack/api.env.example` and `.starcistacks/production/README.md`. `api.enc` must hold `PRIMARY_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY` (it decrypts stored Drive tokens) and `N8N_SIGNING_SECRET`; the knowledge keys are `OPENROUTER_API_KEY`, `EMBEDDING_MODEL` (optionally `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Optional tunables: `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `JOBS_LEASE`. Watchdog thresholds live in the sealed `stack` file: `JOBS_FAILED_ALERT` (20) and `JOBS_STALE_SECONDS` (300). Set a value with `starci app secret set production api --key <KEY>`.

## Watch

`deploy/stack/watchdog.sh` runs every minute from the `nivo` crontab and writes `~/nivo-engine/watchdog.log`. Besides the api/OpenClaw coupling check
it asks `job_stats()` in Postgres (through the be CLI, `jobs watchdog`, on the `app_be` connection) and:

- logs `ALERT failed-jobs` when more than `JOBS_FAILED_ALERT` jobs failed in the last 24 h;
- logs `ALERT jobs-stale` when a job has been queued longer than `JOBS_STALE_SECONDS` (the api is not consuming, or a workspace is saturated).

Each kind alerts at most once per 30 minutes. Alerts are log lines, the same channel as the `recreating api` entries:
`grep ALERT ~/nivo-engine/watchdog.log`.

## Read failed jobs

On the VPS, in `~/nivo-engine/deploy` (each command runs `cli jobs ...` inside the api container, on the `app_be` connection):

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

To stop consuming without losing anything: the worker switch of the api (see the queue settings in `be/docs/guides/jobs.md`) (`QUEUE_ENABLED=false` in the sealed `api` file), then redeploy; messages wait in the queue.

## A stuck job

- A message whose worker died stays invisible for at most the visibility timeout (`QUEUE_VISIBILITY_TIMEOUT`), then comes back with one more attempt.
- A workspace slot of a dead worker frees itself with its lease (`JOBS_LEASE`).
- An outbox row in `running` for long, with no message in `pgmq.q_knowledge`: the ack was lost after the message was deleted. Harmless;
  mark it `done` by hand if it bothers the stale alert.

## Local development

```bash
npm run db:start        # local Supabase (pgmq ships in the image); it prints the URL and the keys
npm run dev:be          # the api in watch mode (ts-node-dev) against the local stack, env exported in your shell (see README.md)
```
