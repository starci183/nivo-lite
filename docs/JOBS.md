# Background jobs

Heavy work (reading a document, chunking, embedding, reading facts, re-embedding) does not run inside a web request. The request writes a
row and returns; the engine does the work and the UI follows the row through Supabase realtime. Owner rulings (2026-10-12): "fire, don't
sit and wait", built the standard way even for lite; and a lite app has NO self-hosted infra (monorepo + Supabase only), so the transport is
**Supabase Queues (pgmq)** in the project's own Postgres, not Redis/BullMQ.

The design is the StarCi queue pattern (knowledge `patterns/be/queues.yaml`): the job commits with the business row, workers with a retry
policy, idempotent handlers and typed job contracts. Only the transport is pgmq.

## Architecture

```
 browser ──upload──▶ Storage (knowledge-uploads, private)
    │
    └─ RPC knowledge_enqueue_source ───────┐   ONE transaction:
                                           ├─ knowledge_sources row (status queued)
                                           ├─ job_outbox row (dedupe_key knowledge.index:<sourceId>, state queued)
                                           └─ pgmq.send('knowledge', {name, payload, dedupe, outbox_id})
                                                    │
 engine (Nest) ─────────────────────────────────┼────────────────────────────────────────────
   JobRegistry poll loop (every 1.5 s, at once after a job ends)
        │  job_read('knowledge', vt 60 s, free slots, ws limit 2)   pgmq.read skips locked rows; a workspace already running 2 jobs is
        │                                                         deferred 3-4 s (job_slots), not counted as an attempt
        ▼
   handler by job name (features/knowledge-jobs): knowledge.index → (JobProducer) knowledge.facts, knowledge.reembed follow-ups
        │  job_touch every 20 s (extends the visibility timeout and the slot lease)
        │  success → job_ack     retryable error → job_fail (5 s, 10 s, 20 s)     final / unrecoverable → onFailed + job_archive
        │  writes knowledge_sources.status / progress / error
        ▼
 Supabase realtime on knowledge_sources ──▶ Badge per row, "Đang xử lý N tài liệu" + Progress on /brain and /knowledge
```

Why no relay: `job_enqueue` (and the knowledge RPCs that call it) writes the outbox row and sends the pgmq message in the same transaction
as the business row. A rolled-back insert never starts work; a committed source always has its message. Supabase JS cannot run a
multi-statement transaction, so every "row + job" pair is one SQL function (RPC).

Why `job_outbox` stays: pgmq has no dedupe, and the chained jobs need one (a re-run of `knowledge.index` must not send a second
`knowledge.facts`). The unique `dedupe_key` gives that; the same row is the audit trail (`state` queued → running → done | failed,
`attempts`, `last_error`) that operators and the watchdog read with plain SQL. A dedupe column on `knowledge_sources` would not cover the
chained jobs, so it is not simpler.

Where things live:

| Piece | File |
| --- | --- |
| Outbox table, knowledge RPCs, bucket, realtime | `supabase/migrations/20261025100000_job_outbox.sql` |
| pgmq queue, job RPCs, slots, enqueue without relay | `supabase/migrations/20261025110000_pgmq_transport.sql` |
| Job contracts (the source) | `src/lib/jobs/contracts.ts` |
| Job contracts (engine copy, GENERATED) | `engine/src/platform/pgmq/contracts.ts` (`node engine/dev/sync-shared.mjs`) |
| Consumer, policy, producer | `engine/src/platform/pgmq/` (`JobsModule`: `JobRegistry`, `JobProducer`, `JobHandler`) |
| Knowledge handlers | `engine/src/features/knowledge-jobs/` |

The old `engine_jobs` queue (`engine/src/platform/queue`) is separate and still carries the OpenClaw work (chat turns, generate, agent
sync, video render). It is not replaced. `ENGINE_WORKER_ENABLED=0` turns that worker off (for local runs against real data).

## Database contract

`job_outbox` (RLS on, service role only): `id`, `workspace_id`, `queue`, `name`, `payload jsonb`, `dedupe_key text unique`, `msg_id`
(the pgmq message), `state` (`queued` | `running` | `done` | `failed`), `attempts` (real starts), `created_at`, `sent_at`, `started_at`,
`finished_at`, `last_error`.

`job_slots` (service role only): `(queue, msg_id)` → `workspace_id`, `lease_until`. One row per running job; the per-workspace limit counts
them under an advisory lock per workspace, so two engines never both take the last slot. A crashed engine's slot ends with its lease.

pgmq: queue `knowledge` (`pgmq.q_knowledge`, archive `pgmq.a_knowledge`). The engine never calls the `pgmq` schema directly; it calls:

| RPC | Caller | Does |
| --- | --- | --- |
| `job_enqueue(ws, queue, name, payload, dedupe)` | service role (engine, server code, other RPCs) | outbox row + `pgmq.send`, idempotent on `dedupe` |
| `job_read(queue, vt, qty, ws_limit)` | engine | `pgmq.read` + workspace slot + attempt count; returns `msg_id, attempt, enqueued_at, message` |
| `job_touch(queue, msg_id, vt)` | engine | `pgmq.set_vt` + slot lease renewal while a handler runs |
| `job_ack(queue, msg_id)` | engine | `pgmq.delete`, slot freed, outbox `done` |
| `job_fail(queue, msg_id, delay_s, error)` | engine | `pgmq.set_vt(delay)`, slot freed, outbox back to `queued` with the error |
| `job_archive(queue, msg_id, error)` | engine | `pgmq.archive`, slot freed, outbox `failed` |
| `job_requeue(outbox_id)` | operators (`jobs.sh retry`) | a failed job sent again, attempts reset |
| `job_stats()` | engine (`/healthz`, readiness), watchdog | per-queue depth and oldest age, running, failed in 24 h, oldest queued |
| `knowledge_enqueue_source(ws, kind, title, storage_path, url, meta)` | owner/manager (browser), service role | source row + `knowledge.index` job |
| `knowledge_retry_source(source)` | owner/manager, service role | a `failed` / `blocked_credits` source back to `queued` with a new job (`:retry:<ms>` key) |

Every `job_*` RPC is `security definer`, revoked from `anon` / `authenticated`, granted to `service_role`.

## Job contracts

`src/lib/jobs/contracts.ts` is the one list of queues, job names and payloads (`JobPayloads`, `JOB_QUEUE`), the source statuses and the
upload bucket. The engine gets a generated copy (the engine image is built from `engine/` alone). Payloads carry ids, never rows: the
handler re-reads the current state.

| Job | Payload | Does |
| --- | --- | --- |
| `knowledge.index` | `{ sourceId, workspaceId }` | read (storage / link / Drive / text) → chunk → embed → `extracting_facts`, enqueue `knowledge.facts` |
| `knowledge.facts` | `{ sourceId, workspaceId }` | read facts window by window into `brain_facts` proposals → `ready` |
| `knowledge.reembed` | `{ workspaceId, model? }` | re-embed chunks made by another model; hands over to a follow-up job after 100 batches |

`knowledge_sources.status`: `queued → reading → indexing → extracting_facts → ready`, or `failed` / `blocked_credits`. A source in
`extracting_facts` already has every passage indexed: agents read it (`lensSources`, `lensPassages`) like a `ready` one.

## Retry policy

`engine/src/platform/pgmq/jobs.types.ts`:

- 4 attempts; after a failed one the message comes back after 5 s, 10 s, 20 s (`job_fail` sets the visibility timeout).
- Attempts are `job_outbox.attempts`, counted when a message really starts. pgmq's own `read_ct` also counts the deferrals of a busy
  workspace, so it is not used.
- A message read but not finished (engine crashed) becomes visible again when its visibility timeout (60 s, extended every 20 s while the
  handler runs) runs out, and counts as one more attempt.
- `PermanentJobError` (bad payload, missing subject) and `BlockedCreditsError` (the workspace has no credits) end the job at once.
  Credits: the source becomes `blocked_credits` with the Vietnamese reason; nothing retries on its own, the owner tops up and presses
  Thử lại (`knowledge_retry_source`).
- A handler's `onFailed(ctx, error)` runs once when the job ends as failed (the last attempt or an unrecoverable error). The knowledge
  handlers write the failure themselves on their last attempt (`ctx.isFinalAttempt`), so they do not need it.
- A job aborted by shutdown is handed back (`job_fail` with delay 0); it is not final.
- Failed messages stay in `pgmq.a_knowledge` and their outbox rows in `state = 'failed'`.

## Idempotency

A job can be delivered more than once (a visibility timeout ran out, a lost ack, a retry). Rules for handlers:

- Re-running on a subject that is already done is a no-op. `knowledge.index` on a source already `ready` / `extracting_facts` returns.
- Write results by replacing, not appending: `knowledge.index` deletes the source's chunks before inserting the new ones (and keeps
  vectors already made with the current model), `knowledge.facts` resumes from `brain_extractions.windows_done`.
- A chained job uses `JobProducer.enqueue(name, payload, dedupe, workspaceId)` (RPC `job_enqueue`) with a dedupe key that names the subject
  and the parent job (`knowledge.facts:<sourceId>:<parent dedupe key>`), so a re-run of the parent does not double the child.
- Credits are metered inside the job with the same `withUsage` / `recordUsage` the web app uses, and `blockedBy` is checked before spending.

## How to add a job

1. Add the name and payload to `JobPayloads` and `JOB_QUEUE` in `src/lib/jobs/contracts.ts`, then `node engine/dev/sync-shared.mjs`.
   A new queue goes into `QUEUES` and needs `select pgmq.create('<queue>');` in a migration.
2. Produce it in the same transaction as the change that needs it:
   - with a business row: a SQL function (RPC) that inserts the row and calls `public.job_enqueue(...)` (see `knowledge_enqueue_source`);
   - from server code with nothing else to commit: `rpc("job_enqueue", …)` with the service-role client;
   - from another job in the engine: `JobProducer.enqueue(...)`.
3. Write the handler in an engine feature module: a `JobHandler<"your.job">` (`name`, `handle(ctx)`, optional `onFailed`) registered with
   the injected `JobRegistry` in `onModuleInit`. Make it idempotent (above). Throw `PermanentJobError` for errors a retry cannot fix and
   `BlockedCreditsError` when the workspace has no credits.
4. Import the feature module in `engine/src/app.module.ts`. The poll loop covers every queue that has a handler.

## Operations

Health:

- `GET /healthz` (liveness, never waits on Supabase): `jobs.stats` (`job_stats()`, refreshed every 10 s: per-queue `depth` and
  `oldestAgeSeconds`, `running`, `failed24h`, `oldestQueuedAgeSeconds`), the registered handlers and the last read.
- `GET /readyz`: the last `engine_jobs` poll reached the database (when that worker is on), `job_stats` answered and the last `job_read`
  worked. The deploy gates on it.
- The watchdog (`engine/deploy/watchdog.sh`) alerts on `failed24h > JOBS_FAILED_ALERT` and `oldestQueuedAgeSeconds > JOBS_STALE_SECONDS`.

SQL (Supabase SQL editor or `psql`):

```sql
select public.job_stats();
select * from pgmq.metrics('knowledge');
select id, name, state, attempts, last_error, created_at from job_outbox where state in ('queued', 'running') order by created_at;
select id, name, attempts, finished_at, last_error from job_outbox where state = 'failed' order by finished_at desc limit 20;
select public.job_requeue('<outbox id>');           -- send a failed job again
select knowledge_retry_source('<sourceId>');        -- or retry a document the owner's way
```

On the VPS, `engine/deploy/jobs.sh` wraps the same (`stats`, `failed`, `open`, `retry`, `retry-failed`); see `docs/OPERATIONS-JOBS.md`.

Settings (engine env, all optional):

| Variable | Default | Meaning |
| --- | --- | --- |
| `JOBS_ENABLED` | `1` | `0` = do not consume (producers still enqueue; messages wait) |
| `JOBS_CONCURRENCY` | `4` | jobs one engine runs at a time |
| `JOBS_WORKSPACE_CONCURRENCY` | `2` | jobs of one workspace running at a time across all engines |
| `JOBS_POLL_MS` | `1500` | pause between empty polls |
| `JOBS_VT_SECONDS` | `60` | visibility timeout of a read message (extended every third of it) |
| `ENGINE_SHUTDOWN_GRACE_MS` | `30000` | time running jobs get on shutdown |
| `ENGINE_WORKER_ENABLED` | `1` | the old `engine_jobs` worker; `0` = off |

Local: `npm run dev:stack` (engine in watch mode against the local Supabase stack, env from `secrets.env` or `NIVO_SECRETS=<file>`;
`DEV_ENGINE_PORT` changes the port). The local Supabase image ships pgmq; apply the migrations and nothing else is needed.

## Later candidates

Not moved yet, but blocking or long enough to belong here: agent performers (`module-*-performers.ts`), the automations tick
(`automation-tick.ts`), the module ticks (booking, content, hiring, shifts) and connection health sweeps. A recurring task becomes a
`pg_cron` schedule that calls `job_enqueue` with a dedupe key per period, so it fires once however many engines run. `pg_net` is not needed
for the knowledge jobs: polling every 1.5 s is enough.
