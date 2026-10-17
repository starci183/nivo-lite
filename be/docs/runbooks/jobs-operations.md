# Operating the job system

Design and handler contracts are in `be/docs/guides/jobs.md`. This page is the operator's side: deploy, look at failures, retry, recover.

Shape in one paragraph: the web app (or an RPC) writes the business row, a `job_outbox` row and a **pgmq** message in ONE Postgres
transaction, in the app's own Supabase. The api's workers poll the queue, run the handlers (knowledge: read, extract, embed) and ack,
retry or archive each message. There is no queue service to run: Supabase holds the queues and backs them up with the database.

## Deploy

The api (and the OpenClaw and n8n stack around it) ships through `.github/workflows/stack-deploy.yml` (environment `production`), by hand only:
Actions > Deploy stack > Run workflow. The cutover order and the one-time steps are in `be/docs/runbooks/cutover.md`; the stack itself is described
in `be/docs/runbooks/vps-stack.md`.

Order matters: **apply the migrations to Supabase before the api deploy** (`supabase db push`, or the database deploy workflow). An api without
the queue objects of the platform migration is not ready and the deploy rolls back.

What the **Deploy stack** workflow does, in order (the api is one service of the Swarm stack `nivo`; `be/docs/runbooks/vps-stack.md`):

1. Builds the api and web images on the runner (the api build runs the type gate) and pushes them to GHCR; the deploy uses their digests.
2. Renders the stack, decrypts the sealed files in memory with the age identity and creates one versioned Swarm secret per key; the api reads `/run/secrets/<KEY>` through `<KEY>_FILE`.
3. `docker stack deploy --prune`: the api updates start-first, so the old task serves until the new one is healthy (`/healthz`, liveness).
4. Observes convergence (desired versus running replicas, no failed task) and verifies `/readyz` (the database answers), a GraphQL probe, OpenClaw by service DNS and `jobs watchdog`.
5. Unhealthy: the update rolls itself back and the workflow deploys the previous accepted release again. Healthy: the release is accepted and superseded secrets are removed.

### Secrets and variables to set before the first api deploy

GitHub environment `production`:

| Kind   | Name                             | Notes                                                                                                                                                                       |
| ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| var    | `VPS_HOST`, `VPS_USER`           | same as the web deploy                                                                                                                                                      |
| secret | `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | same as the web deploy (CI deploy key, pinned host keys)                                                                                                                    |
| secret | the age identity                 | the age identity of `.sops.yaml` (its secret name is in `.github/workflows/stack-deploy.yml`); the only way the application secrets reach the job (protect the environment) |

The application secrets are in `.starcistacks/production/secrets/{api,auth,stack}.enc`; names and meaning are in `.starcistacks/production/infra/swarm/api.env.example` and `.starcistacks/production/README.md`. The `api` sealed file must hold `PRIMARY_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CHANNEL_TOKEN_KEY` (it decrypts stored Drive tokens) and `N8N_SIGNING_SECRET`; the knowledge keys are the model provider key and the embedding model (with an optional embedding endpoint and key; `be/src/modules/integrations/llm/llm.config.ts` lists the names), `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`. Optional tunables: `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL`, `QUEUE_VISIBILITY_TIMEOUT`, `JOBS_LEASE`. Watchdog thresholds live in the sealed `stack` file: the failed-jobs limit (20) and the stale age in seconds (300). Set a value with `starci app secret set production api --key <KEY>`.

## Watch

The api watches its own jobs; there is no host crontab and no watchdog script. An in-process monitor of the api (not a queue job, so it still fires when the queue consumer is stuck) reads `job_stats()` every `JOBS_ALERT_INTERVAL` (default 5 minutes) and, per kind at most once every 30 minutes:

- `job-ops.alert.failed-jobs`: more than `JOBS_ALERT_FAILED_MAX` jobs (default 20) failed in the last 24 h;
- `job-ops.alert.jobs-stale`: a job has been queued longer than `JOBS_ALERT_STALE_SECONDS` (default 300; the api is not consuming, or a workspace is saturated).

Each alert is one structured error log event and one `app_errors` row (scope `jobs.alert`, shown in the team console `/admin/health`). The limits come from the sealed `stack` member (the same two thresholds) at deploy time. Read them with `docker service logs nivo_nivo-api --since 1h` on the manager and filter for `job-ops.alert`. If the api itself is down, Swarm reschedules the task and the convergence check of the deploy reports it.

## Read failed jobs

On the VPS manager, or anywhere the manager is reachable over ssh (`--ssh-cmd`; each command resolves the running api task and runs `cli jobs ...` inside it, on the `app_be` connection):

```bash
starci app stack jobs stats --env production   # job_stats(): depth and oldest age per queue, running, failed in 24 h, oldest queued
starci app stack jobs failed --env production  # last 20 failed jobs: outbox id | name | attempts | finished_at | last_error (no payload)
starci app stack jobs failed 100 --env production
starci app stack jobs open --env production    # the oldest queued / running jobs
```

The same from the Supabase SQL editor:

```sql
select public.job_stats();
select id, name, attempts, finished_at, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;
select msg_id, read_ct, archived_at, message->>'name', message->>'dedupe' from pgmq.a_knowledge order by archived_at desc limit 20;
```

The api log has the handler error with the dedupe key: `docker service logs nivo_nivo-api --since 1h | grep '<dedupe key>'`.

There is no `GET /admin/jobs/failed` endpoint: the SQL above needs no endpoint and no admin guard.

## Retry

```bash
starci app stack jobs retry <outbox-id> --execute   # send one failed job again (job_requeue: new message, attempts reset)
starci app stack jobs retry-failed [hours] --execute   # every job that failed in the last <hours> (default 24)
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
