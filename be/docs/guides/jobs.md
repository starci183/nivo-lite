# Background jobs

Heavy work (reading a document, chunking, embedding, reading facts, re-embedding, rendering a video, running an automation tick) does not run inside a web request. The request writes a row and returns; a worker does the work and the UI follows the row. Owner rulings (2026-10-12): "fire, don't sit and wait", built the standard way even for lite; and a lite app has NO self-hosted infra (monorepo + Supabase only), so the transport is **Supabase Queues (pgmq)** in the project's own Postgres, not Redis/BullMQ.

The design is the StarCi queue pattern: the job commits with the business row, workers with a retry policy, idempotent handlers and typed job contracts. Only the transport is pgmq. When this page and the code disagree, the code wins.

## Where things live (be)

| Piece                                                                                | Path                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| The queue capability: outbox, pgmq transport, worker loops, schedulers, status       | `be/src/modules/platform/queue` (`QueueOutbox`, `QueueWorkerRegistry`, `PgmqQueueTransportClient`, `QueueWorkerService`, `QueueStatusService`) |
| The fenced claim of a running job (a fencing token per claim) and the processor base | `be/src/modules/platform/jobs` (`FencedProcessor`, `JobClaimService`, `JobFenceService`, `JobRunnerService`; table `public.jobs`)              |
| Queue contracts: job names, payloads, dedupe keys, the typed producer, schedulers    | `be/src/modules/queues/<queue>/` (27 queues; `modules/queues/knowledge` is the reference)                                                      |
| The job itself: processor, steps under the claimed token, transport to the queue     | `be/src/features/jobs/<job>/{steps,transport/queue}`                                                                                           |
| Which queues run and which schedulers are registered                                 | `be/apps/api/src/compose/jobs.ts` (queue list) and `be/apps/api/src/compose/schedulers.ts` (scheduler list)                                    |
| The SQL: `pgmq.create` per queue, `job_*` functions, `job_outbox`, `job_slots`       | `supabase/migrations/20261026000000_baseline.sql`                                                                                              |
| Operator commands                                                                    | `be/src/features/cli/jobs` (`cli jobs stats\|failed\|open\|retry\|retry-failed\|watchdog`) and `starci app stack jobs`                         |

## Architecture

```
 request ──► application handler ───────┐   ONE transaction (QueueOutbox.write(tx, queue, payload, { job, dedupeKey })):
                                        ├─ the business row (for example knowledge_sources, status queued)
                                        ├─ job_outbox row (dedupe_key knowledge.index:<sourceId>, state queued)
                                        └─ pgmq.send('knowledge', {name, payload, dedupe, outbox_id})
                                                 │
 api (Nest) ─────────────────────────────┼──────────────────────────────────────────────────
   one worker loop per registered queue (QUEUE_POLL_INTERVAL, at once after a job ends)
        │  job_read(queue, vt, free slots, ws limit)   pgmq.read skips locked rows; a workspace already running
        │                                              QUEUE_WORKSPACE_CONCURRENCY jobs is deferred (job_slots), not counted as an attempt
        ▼
   FencedProcessor of the job name (be/src/features/jobs/<job>): steps advance under the claimed fence token; chained jobs through the typed producer
        │  job_touch every third of the visibility timeout (extends the timeout and the slot lease)
        │  success → job_ack     retryable error → job_fail (5 s, 10 s, 20 s)     final / unrecoverable → onFailed + job_archive
        ▼
 the business row carries the status / progress / error the UI shows
```

Why no relay: `job_enqueue` writes the outbox row and sends the pgmq message in the same transaction as the business row. A rolled-back insert never starts work; a committed row always has its message. Why `job_outbox` stays: pgmq has no dedupe, and chained jobs need one; the same row is the audit trail (`state` queued → running → done | failed, `attempts`, `last_error`) that operators and the watchdog read with plain SQL.

Recurring ticks (automation, shifts, agents sync, decisions drain, content tick, connection health, zalo refresh, data sync) are `QueueSchedulerDefinition`s in the scheduler list (`be/apps/api/src/compose/schedulers.ts`): at boot the api upserts each as a pg_cron job by id (`SELECT pgmq.send(...)`), so a pool of replicas fires each tick once per interval. Four other pg_cron jobs belong to the baseline (`ai-generations-prune`, `hiring-apply-hits-prune`, `hiring-tick`, `video-renders-reap`). The migration `supabase/migrations/_archive/20261020110000_drop-engine-schema.sql` removed the legacy HTTP ticks of the engine.

## Database contract

`job_outbox` (RLS on, closed to browser roles): `id`, `workspace_id`, `queue`, `name`, `payload jsonb`, `dedupe_key text unique`, `msg_id` (the pgmq message), `state` (`queued` | `running` | `done` | `failed`), `attempts` (real starts), `created_at`, `sent_at`, `started_at`, `finished_at`, `last_error`.

`job_slots`: `(queue, msg_id)` → `workspace_id`, `lease_until`. One row per running job; the per-workspace limit counts them under an advisory lock per workspace, so two replicas never both take the last slot. A crashed worker's slot ends with its lease.

The api never calls the `pgmq` schema directly; the role `app_be` holds execute on exactly these functions:

| Function                                        | Caller                                                                   | Does                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `job_enqueue(ws, queue, name, payload, dedupe)` | `QueueOutbox` (in the caller's transaction)                              | outbox row + `pgmq.send`, idempotent on `dedupe`                         |
| `job_read(queue, vt, qty, ws_limit)`            | the worker                                                               | `pgmq.read` + workspace slot + attempt count                             |
| `job_touch(queue, msg_id, vt)`                  | the worker                                                               | `pgmq.set_vt` + slot lease renewal while a handler runs                  |
| `job_ack(queue, msg_id)`                        | the worker                                                               | `pgmq.delete`, slot freed, outbox `done`                                 |
| `job_fail(queue, msg_id, delay_s, error)`       | the worker                                                               | `pgmq.set_vt(delay)`, slot freed, outbox back to `queued` with the error |
| `job_archive(queue, msg_id, error)`             | the worker                                                               | `pgmq.archive`, slot freed, outbox `failed`                              |
| `job_requeue(outbox_id)`                        | operators (`cli jobs retry`)                                             | a failed job sent again, attempts reset                                  |
| `job_stats()`                                   | `QueueStatusService` (`/healthz`, `/readyz`), `cli jobs stats\|watchdog` | per-queue depth and oldest age, running, failed in 24 h, oldest queued   |

## Job contracts

Each queue's contracts file (`be/src/modules/queues/<queue>/<queue>.contracts.ts`) is the one list of its job names, payloads and dedupe keys. Payloads carry ids, never rows: the handler re-reads the current state. The knowledge queue:

| Job                 | Payload                      | Does                                                                                                 |
| ------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `knowledge.index`   | `{ sourceId, workspaceId }`  | read (storage / link / Drive / text) → chunk → embed → `extracting_facts`, enqueue `knowledge.facts` |
| `knowledge.facts`   | `{ sourceId, workspaceId }`  | read facts window by window into `brain_facts` proposals → `ready`                                   |
| `knowledge.reembed` | `{ workspaceId, model? }`    | re-embed chunks made by another model; hands over to a follow-up job after 100 batches               |
| `brain.command`     | `{ commandId, workspaceId }` | carries out a command asked on the Second Brain or Knowledge page                                    |

`knowledge_sources.status`: `queued → reading → indexing → extracting_facts → ready`, or `failed` / `blocked_credits`.

## Retry policy

`be/src/modules/platform/queue/queue.policy.ts`:

- 4 attempts; after a failed one the message comes back after 5 s, 10 s, 20 s (`job_fail` sets the visibility timeout).
- Attempts are `job_outbox.attempts`, counted when a message really starts (pgmq's `read_ct` also counts the deferrals of a busy workspace, so it is not used).
- A message read but not finished (worker crashed) becomes visible again when its visibility timeout runs out, and counts as one more attempt.
- `QueueError` code `Unrecoverable` (`be/src/modules/platform/queue/errors/queue.error.ts`; bad payload, missing subject, no credits: reason `blocked_credits`) ends the job at once; the `RetryAfter` code retries after the seconds it carries. Nothing retries a blocked-credits source on its own: the owner tops up and presses Retry.
- `onFailed(delivery, cause)` of the processor runs once when the job ends as failed.
- A job aborted by shutdown is handed back (`job_fail` with delay 0); it is not final.
- Failed messages stay in `pgmq.a_<queue>` and their outbox rows in `state = 'failed'`.

## Idempotency

A job can be delivered more than once (a visibility timeout ran out, a lost ack, a retry). Handlers:

- Re-running on a subject that is already done is a no-op. `knowledge.index` on a source already `ready` / `extracting_facts` returns.
- Write results by replacing, not appending (the index step deletes the source's chunks before inserting new ones; the facts job resumes from `brain_extractions.windows_done`).
- A chained job uses the typed producer with a dedupe key that names the subject and the parent job, so a re-run of the parent does not double the child.
- Credits are metered inside the job and `blockedBy` is checked before spending.

## How to add a job

1. In `be/src/modules/queues/<queue>/` add the job name, payload and dedupe-key builder to the contracts, and the typed producer. A new queue needs `select pgmq.create('<queue>')` in a forward migration and an entry in the queue list (`be/apps/api/src/compose/jobs.ts`).
2. Produce it in the same transaction as the change that needs it: from the application handler with `outbox.write(tx, ...)`, or from another job step through the typed producer.
3. Write the processor in `features/jobs/<job>/`: a `FencedProcessor` with `queue` and `job`, steps that advance under the claimed token, and the queue module that hands the processor to the `JobProcessorRegistry`. Make it idempotent. Throw a `QueueError` for errors a retry cannot fix.
4. Register the queue module in the api composition (`be/apps/api/src/app.module.ts`). A recurring tick is a `QueueSchedulerDefinition` in the scheduler list (`be/apps/api/src/compose/schedulers.ts`).
5. A "retry" action exposed to a user (GraphQL) must enqueue the owning job through the outbox, never run the work inline.

## Operations

Health: `GET /healthz` (liveness, never waits on Supabase) and `GET /readyz` (readiness: the database answers within a bounded time; the ingress and the deploy gate on it, a restart never does). The api raises its own alerts (an in-process monitor, no host cron): `failed24h > JOBS_ALERT_FAILED_MAX` and `oldestQueuedAgeSeconds > JOBS_ALERT_STALE_SECONDS` become a `job-ops.alert.*` log event and an `app_errors` row.

SQL (Supabase SQL editor or `psql`):

```sql
select public.job_stats();
select * from pgmq.metrics('knowledge');
select id, name, state, attempts, last_error, created_at from job_outbox where state in ('queued', 'running') order by created_at;
select id, name, attempts, finished_at, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;
select public.job_requeue('<outbox id>');           -- send a failed job again
select knowledge_retry_source('<sourceId>');        -- or retry a document the owner's way
```

On the VPS, `starci app stack jobs` resolves the api task of the Swarm stack and wraps `cli jobs ...` inside the api container (`stats`, `failed`, `open`, `retry`, `retry-failed`); see `be/docs/runbooks/jobs-operations.md`.

Settings (api environment, all optional):

| Variable                       | Default         | Meaning                                                           |
| ------------------------------ | --------------- | ----------------------------------------------------------------- |
| `QUEUE_ENABLED`                | `true`          | `false` = do not consume (producers still enqueue; messages wait) |
| `QUEUE_CONCURRENCY`            | `4`             | jobs one api runs at a time per queue                             |
| `QUEUE_WORKSPACE_CONCURRENCY`  | `2`             | jobs of one workspace running at a time across all replicas       |
| `QUEUE_POLL_INTERVAL`          | `500ms`         | pause between empty polls                                         |
| `QUEUE_VISIBILITY_TIMEOUT`     | `60s`           | visibility timeout of a read message (extended every third of it) |
| `QUEUE_SHUTDOWN_GRACE`         | `30s`           | time running jobs get on shutdown                                 |
| `JOBS_LEASE`, `JOBS_WORKER_ID` | `60s`, `worker` | the fenced claim's lease and the worker name                      |

Local: `npm run db:start` (the local Supabase image ships pgmq; the migrations are all that is needed), then `npm run dev:be` with the API's environment exported in your shell (README.md).
