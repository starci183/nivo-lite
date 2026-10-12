# Background jobs

Heavy work (reading a document, chunking, embedding, reading facts, re-embedding) does not run inside a web request. The request writes a
row and returns; the engine on the VPS does the work and the UI follows the row through Supabase realtime. Owner ruling (2026-10-12):
"fire, don't sit and wait", built the standard way even for lite.

The design is the StarCi queue pattern (`starci-academy-backend/.claude/examples/ecommerce-app/be/src/modules/platform/queue`,
knowledge `patterns/be/queues.yaml`): a transactional outbox, a relay into BullMQ, workers with a retry policy, idempotent handlers and
typed job contracts.

## Architecture

```
 browser ──upload──▶ Storage (knowledge-uploads, private)
    │
    └─ server action ─▶ RPC knowledge_enqueue_source ──┐   ONE transaction:
                                                       ├─ knowledge_sources row (status queued)
                                                       └─ job_outbox row (knowledge.index)
                                                                │
 engine (Nest, VPS) ────────────────────────────────────────────┼──────────────────────────
   OutboxRelayService  every 1 s: job_outbox_claim(50) ─────────┘  (FOR UPDATE SKIP LOCKED)
        │  Queue.add(name, payload, { jobId: bullmqJobId(dedupe_key), attempts 4, backoff })
        │  job_outbox_relayed(ids)            (Redis refused → job_outbox_release(ids, error))
        ▼
   Redis / BullMQ  queue "knowledge"
        ▼
   JobRegistry  one Worker per queue, concurrency 4
        │  WorkspaceSemaphore: at most 2 running jobs per workspace (else back to delayed, no attempt spent)
        ▼
   handler by job name (features/knowledge-jobs): knowledge.index → (JobProducer) knowledge.facts, knowledge.reembed
        │  writes knowledge_sources.status / progress / error
        ▼
 Supabase realtime on knowledge_sources ──▶ Badge per row, "Đang xử lý N tài liệu" + Progress on /brain and /knowledge
```

Why an outbox and not `queue.add` from the server action: the job row commits together with the business row. A rolled-back insert never
starts work, and a committed source always has its job, even if Redis is down or `REDIS_URL` is not set. The relay drains the outbox when
Redis comes back. Supabase JS cannot run a multi-statement transaction, so every "row + job" pair is one SQL function (RPC).

Where things live:

| Piece | File |
| --- | --- |
| Table, RPCs, bucket, realtime | `supabase/migrations/20261025100000_job_outbox.sql` |
| Job contracts (web copy) | `src/lib/jobs/contracts.ts` |
| Job contracts (engine copy, identical below the header) | `engine/src/platform/bullmq/contracts.ts` |
| Relay, workers, policy, semaphore, producer | `engine/src/platform/bullmq/` (`BullmqModule`, the only importer of `bullmq` / `ioredis`) |
| Knowledge handlers | `engine/src/features/knowledge-jobs/` |
| Redis in production | `engine/deploy/docker-compose.yml` service `redis` |

The old `engine_jobs` queue (`engine/src/platform/queue`) is separate and still carries the OpenClaw work (chat turns, generate, agent
sync, video render). It is not replaced.

## Database contract

`job_outbox` (RLS on, service role only): `id`, `workspace_id`, `queue`, `name`, `payload jsonb`, `dedupe_key text unique`, `created_at`,
`claimed_at`, `relayed_at`, `attempts` (relay claims), `last_error`.

| RPC | Caller | Does |
| --- | --- | --- |
| `knowledge_enqueue_source(p_workspace, p_kind, p_title, p_storage_path, p_url, p_meta) → uuid` | owner/manager of the workspace (or service role) | inserts `knowledge_sources` (status `queued`, progress 0) and the `knowledge.index` outbox row, dedupe `knowledge.index:<sourceId>` |
| `knowledge_retry_source(p_source) → uuid` | owner/manager | a `failed` / `blocked_credits` source goes back to `queued` with a new job, dedupe `knowledge.index:<id>:retry:<ms>`; any other status is a no-op |
| `job_enqueue(p_workspace, p_queue, p_name, p_payload, p_dedupe) → uuid` | service role | generic producer; an existing dedupe key returns the existing row and adds nothing |
| `job_outbox_claim(p_limit)`, `job_outbox_relayed(p_ids)`, `job_outbox_release(p_ids, p_error)` | the engine relay | claim (30 s claim lease, SKIP LOCKED), mark relayed, hand back |

`knowledge_enqueue_source` kinds:

- `file`: `p_storage_path` = `<workspaceId>/<uuid>/<filename>` in bucket `knowledge-uploads` (uploaded by the browser first; must start
  with the workspace id). Stored in `knowledge_sources.storage_path`. Title defaults to the file name without extension.
- `url`: `p_url` (http/https). Stored in `knowledge_sources.source_url` and, as the old synchronous path did, in `content` until the worker
  replaces it with the text.
- `text` / `faq`: the body is `p_meta.content`; it is copied into `knowledge_sources.content`. A title is required.
- `p_meta`: `{ topic?, tags?: string[], visibility?: "public" | "internal", module?, origin?, content? }`. `origin` (the ZIP or Drive
  folder a file came from) goes to `knowledge_sources.origin`. An unknown module is dropped.

`knowledge_sources` lifecycle: `queued → reading → indexing → extracting_facts → ready`, or `failed` / `blocked_credits`, with `progress`
(0-100) and `error`. `pending` remains valid for rows of the old synchronous path. The table is in the `supabase_realtime` publication;
members read it through the existing `is_member` policy.

Storage: bucket `knowledge-uploads` is private (12 MB per object). Owners and managers may INSERT under their workspace prefix
(`storage_ws_manager`); there is no select policy, so only the service role (the engine) reads the bytes.

## Queues and contracts

Payloads carry ids, never rows: a handler re-reads the current state, so a duplicate or late delivery sees the truth.

| Job | Queue | Payload | Does | Dedupe key |
| --- | --- | --- | --- | --- |
| `knowledge.index` | `knowledge` | `{ sourceId, workspaceId }` | read (Storage / link / text) → extract → chunk → embed; then enqueues `knowledge.facts` | `knowledge.index:<sourceId>` (retry: `…:retry:<ms>`) |
| `knowledge.facts` | `knowledge` | `{ sourceId, workspaceId }` | read facts of a ready source into `brain_facts` proposals (conflicts surfaced) | `knowledge.facts:<sourceId>:<content hash>` (suggested) |
| `knowledge.reembed` | `knowledge` | `{ workspaceId, model? }` | re-embed chunks made by another model | `knowledge.reembed:<workspaceId>:<model>` (suggested) |

The BullMQ job id is `bullmqJobId(dedupe_key)` = the key with `:` replaced by `|` (BullMQ rejects custom ids containing `:` unless they have
exactly three parts). It is deterministic, so relaying the same row twice still makes one job.

Every payload has `workspaceId` (a uuid): the per-workspace limit is keyed on it and a job without it fails at once.

## Retry policy

`engine/src/platform/bullmq/bullmq.policy.ts`:

- 4 attempts, exponential backoff from 5 s (5 s, 10 s, 20 s).
- `JOBS_CONCURRENCY` (default 4) jobs per worker process; `JOBS_WORKSPACE_CONCURRENCY` (default 2) running jobs per workspace across
  all processes. A Redis sorted set per workspace holds the running job ids with a 90 s lease, renewed while the job runs, so a crashed
  worker's slot frees itself. A job whose workspace is full goes back to `delayed` for about 3 s without spending an attempt. (BullMQ Pro
  "groups" do this natively; the open-source edition does not have them.)
- BullMQ's lock on an active job is 60 s and renewed automatically; a stalled job (dead worker) is re-delivered, at most twice.
- `PermanentJobError` (bad payload, missing subject) and `BlockedCreditsError` (the workspace has no credits) are BullMQ
  `UnrecoverableError`s: the job fails at once, without retries. For credits the handler sets the source to `blocked_credits`; the owner
  tops up and presses Thử lại (`knowledge_retry_source`).
- A handler's `onFailed(ctx, error)` runs once when the job ends as failed (the last attempt or an unrecoverable error). That is where the
  source becomes `failed` with its message. A job aborted by shutdown is not final: BullMQ re-delivers it.
- Completed jobs are kept 24 h (so a late re-add of the same id is ignored), failed jobs 7 days.

## Idempotency

A job can be delivered more than once: the relay re-adds a row after a crash between add and mark (absorbed by the job id), a stalled job is
re-delivered, and retries re-run the handler. Rules for handlers:

- Re-running on a subject that is already done is a no-op. `knowledge.index` on a source already `ready` returns at once.
- Write results by replacing, not appending: `knowledge.index` deletes the source's chunks before inserting the new ones, and
  `knowledge.facts` resumes from `brain_extractions.windows_done` and never re-reads unchanged text (content hash + prompt version).
- A chained job uses `JobProducer.enqueue(name, payload, dedupe, workspaceId)` (RPC `job_enqueue`), never `Queue.add`, with a dedupe key
  that names the subject and its version, so a re-run of the parent does not double the child.
- Credits are metered inside the job with the same `withUsage` / `recordUsage` the web app uses, and `blockedBy` is checked before spending.

## How to add a job

1. Add the name and payload to `JobPayloads` and `JOB_QUEUE` in **both** contract files (`src/lib/jobs/contracts.ts` and
   `engine/src/platform/bullmq/contracts.ts`; keep the bodies identical). A new queue goes into `QUEUES`.
2. Produce it in the same transaction as the change that needs it:
   - with a business row: a SQL function (RPC) that inserts the row and the `job_outbox` row (see `knowledge_enqueue_source`);
   - from server code with nothing else to commit: `rpc("job_enqueue", …)` with the service-role client;
   - from another job in the engine: `JobProducer.enqueue(...)`.
3. Write the handler in an engine feature module: a class implementing `BullJobHandler<"your.job">` (`handle`, optional `onFailed`) that
   calls `registry.register(this)` in its constructor or `onModuleInit`. Make it idempotent (above). Throw `PermanentJobError` for errors a
   retry cannot fix and `BlockedCreditsError` when the workspace has no credits.
4. Import the feature module in `engine/src/app.module.ts`. The worker for its queue starts at boot.

## Operations

Health:

- `GET /healthz` (liveness, never waits on Supabase or Redis): `outbox.oldestUnrelayedAgeSeconds`, `outbox.unrelayed`, `jobs.failed`,
  `jobs.waiting/active/delayed`, the registered handlers and the relay state. The numbers are refreshed every 10 s. The watchdog alerts
  on a growing outbox age (the relay is stuck) and on `jobs.failed`.
- `GET /readyz`: the last `engine_jobs` poll reached the database and, with `REDIS_URL` set, Redis answers PING. The deploy gates on it.

Waiting work that never reached Redis:

```sql
select name, workspace_id, created_at, claimed_at, attempts, last_error
from job_outbox where relayed_at is null order by created_at limit 50;
```

Sources that are stuck or failed:

```sql
select id, title, status, progress, error, updated_at from knowledge_sources
where status not in ('ready', 'pending') order by updated_at desc limit 50;
```

Failed BullMQ jobs (prefix `nivo`, queue `knowledge`):

```bash
docker compose exec redis redis-cli zrevrange nivo:knowledge:failed 0 20      # job ids, newest first
docker compose exec redis redis-cli hgetall 'nivo:knowledge:<jobId>'           # name, data, failedReason, stacktrace, attemptsMade
```

Retrying: the owner presses Thử lại on a failed row (`knowledge_retry_source`). An operator can do the same in SQL as the service role:
`select knowledge_retry_source('<sourceId>');`. Re-adding the same BullMQ id does nothing while the failed job is kept, which is why a retry
uses a new dedupe key.

Redis lost or flushed: queued jobs that were already relayed are gone. Their sources stay in `queued` / `reading` / …; mark them failed so
the owner can retry them (or call `knowledge_retry_source` after setting them `failed`). Rows not yet relayed are still in `job_outbox` and
are relayed when Redis is back.

## Configuration

Engine (`engine/deploy/.env`, pushed from the `[engine]` block of `secrets.env` by `scripts/env-sync.mjs`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `REDIS_URL` | `redis://redis:6379` in compose | unset = relay and workers off; jobs wait in `job_outbox` |
| `JOBS_CONCURRENCY` | 4 | jobs per worker process |
| `JOBS_WORKSPACE_CONCURRENCY` | 2 | running jobs per workspace |
| `JOBS_RELAY_MS` | 1000 | relay pause after a pass with less than a full batch |
| `JOBS_RELAY_BATCH` | 50 | outbox rows per pass |
| `JOBS_PREFIX` | `nivo` | Redis key prefix |
| `ENGINE_SHUTDOWN_GRACE_MS` | 30000 | running jobs get this long to finish on SIGTERM |

The knowledge jobs also read `OPENROUTER_API_KEY` / `EMBEDDING_*`, `CHANNEL_TOKEN_KEY` and `GOOGLE_OAUTH_CLIENT_ID/SECRET`; env-sync copies
them from the `[app]` block when the `[engine]` block does not set them.

Local: `docker run -d --name nivo-redis-dev -p 127.0.0.1:56379:6379 redis:7-alpine redis-server --appendonly yes`, then run the engine
with `REDIS_URL=redis://127.0.0.1:56379` and `SUPABASE_URL` pointing at the local stack (see `engine/README.md`). Without Redis the web
app still enqueues: rows wait in `job_outbox` until a relay runs.

## Later candidates

Not moved yet, but blocking or long enough to belong here: agent performers (`module-*-performers.ts`), the automations tick
(`automation-tick.ts`, a BullMQ job scheduler would replace the external cron), the module ticks (booking, content, hiring, shifts) and
connection health sweeps. A recurring task becomes a BullMQ job scheduler (`upsertJobScheduler`) declared with its queue, so it fires once
per deployment however many engine processes run.
