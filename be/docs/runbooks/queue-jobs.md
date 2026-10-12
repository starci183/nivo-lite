# Queue and jobs on Supabase

The back end runs background work on Supabase Queues (pgmq) in the primary database. Two platform capabilities carry it:

- `modules/platform/queue`: the `QueueOutbox` and `QueueWorkerRegistry` ports over the `job_*` functions.
- `modules/platform/jobs`: the fenced claim (`public.jobs`, a fencing token per claim) that a `FencedProcessor` runs under.

## The wire

| Step  | Function / table | Who calls it                                                                             |
| ----- | ---------------- | ---------------------------------------------------------------------------------------- |
| Send  | `job_enqueue`    | `QueueOutbox.write(tx, queue, payload, { job, dedupeKey })`, in the caller's transaction |
| Read  | `job_read`       | the worker of a queue, `QUEUE_CONCURRENCY` at a time                                     |
| Renew | `job_touch`      | the worker, every third of `QUEUE_VISIBILITY_TIMEOUT` while the handler runs             |
| Done  | `job_ack`        | the worker, after the handler returned                                                   |
| Retry | `job_fail`       | the worker: backoff 5 s, 10 s, 20 s, or the pause a `QueueError` RetryAfter asked for    |
| Dead  | `job_archive`    | the worker: attempts (4) used up, a `QueueError` Unrecoverable, or a job nobody handles  |
| Limit | `job_slots`      | inside `job_read`: `QUEUE_WORKSPACE_CONCURRENCY` jobs per workspace across every replica |

`app_be` holds execute on exactly these functions (`20261012123100_be-queue-grants.sql`); `job_outbox` and `job_slots` stay closed to it.
A job whose payload carries `workspaceId` (a uuid) counts against that workspace's limit. A write without a dedupe key gets a fresh
`<job>:<uuid>`; with one, the same key twice is one job (the unique `job_outbox.dedupe_key`).

## Adding a queue

1. A migration: `select pgmq.create('<queue>')` (the `pgmq` schema is never exposed to clients).
2. `modules/queues/<queue>/`: `<queue>.contracts.ts` (job names, payloads, dedupe keys), `<queue>.queue.ts` (the typed producer calling
   `outbox.write(tx, QUEUE, payload, { job, dedupeKey })`), `<queue>.module.ts`, `index.ts`. `modules/queues/knowledge` is the first.
3. `features/jobs/<job>/`: a `FencedProcessor` with `queue` and `job`, steps that advance under the claimed token, and the queue module that
   hands the processor to the `JobProcessorRegistry`. Several jobs may share a queue; each gets its own processor.
4. A schedule is a `QueueSchedulerDefinition` in `QueueModule.register({ schedulers })` (pg_cron upserts it by id, once per interval).

## Errors a handler can throw

| Throw                                              | Effect                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| anything else                                      | retried with backoff until the attempts are used up, then archived         |
| `QueueError` code `QUEUE_UNRECOVERABLE` (`reason`) | archived at once; `reason` is kept on the outbox row                       |
| `QueueError` code `QUEUE_RETRY_AFTER` (`seconds`)  | retried after those seconds (still archived once the attempts are used up) |

When a job ends as failed, `onFailed(delivery, cause)` of its processor runs once (write the failure the owner sees there).
The knowledge queue's out-of-credits case is Unrecoverable with reason `blocked_credits` (`KNOWLEDGE_BLOCKED_CREDITS`).

## Engine mapping (engine_jobs worker and pgmq consumer to the back end)

The engine had two consumers: the `engine_jobs` worker (`engine/src/platform/queue`) and the pgmq `JobRegistry`
(`engine/src/platform/pgmq`). Both become `QueueWorkerService` handlers.

| engine concept                                                                      | back end                                                                                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `JobRegistry.register(handler)`                                                     | `QueueWorkerRegistry.add({ queue, job, handle, failed })`                                             |
| `PermanentJobError`, `UnrecoverableJobError`                                        | `QueueError` code `QUEUE_UNRECOVERABLE`                                                               |
| `BlockedCreditsError`                                                               | `QueueError` Unrecoverable with reason `blocked_credits`                                              |
| `RetryJobError(seconds)`                                                            | `QueueError` code `QUEUE_RETRY_AFTER` with `seconds`                                                  |
| `JobHandler.onFailed`                                                               | `FencedProcessor.onFailed` / `QueueHandler.failed`                                                    |
| `maxConcurrent` (own slots)                                                         | `concurrency` on the processor (its queue has its own worker loop)                                    |
| `JobContext.signal`                                                                 | `QueueDelivery.signal` (aborted on shutdown after `QUEUE_SHUTDOWN_GRACE`)                             |
| `JOBS_ENABLED=0`                                                                    | `QUEUE_ENABLED=0` (producers still enqueue, messages wait)                                            |
| `JOBS_CONCURRENCY`, `JOBS_WORKSPACE_CONCURRENCY`, `JOBS_VT_SECONDS`, `JOBS_POLL_MS` | `QUEUE_CONCURRENCY`, `QUEUE_WORKSPACE_CONCURRENCY`, `QUEUE_VISIBILITY_TIMEOUT`, `QUEUE_POLL_INTERVAL` |

| `engine_jobs.kind`    | job lane                                                                     | suggested queue / job                                 |
| --------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `chat.turn`           | L08 `run-chat-turn`                                                          | `chat-turn` / `chat.turn`                             |
| `connection.health`   | L08 `check-connection-health`                                                | `connection-health` / `connection.health`             |
| `openclaw.sync_agent` | L10 `sync-agents`                                                            | `agent-sync` / `openclaw.sync_agent`                  |
| `openclaw.generate`   | L10 `generate-with-agent`                                                    | `agent-generate` / `openclaw.generate`                |
| `n8n.emit`            | L11 `emit-n8n-event`                                                         | `n8n` / `n8n.emit`                                    |
| `video.render`        | L15 `render-video` (`concurrency` 1)                                         | `video-render` / `video.render`                       |
| `knowledge.*`         | L06 `index-knowledge-source`, `extract-knowledge-facts`, `reembed-knowledge` | `knowledge` / `knowledge.index`, `.facts`, `.reembed` |

`engine_jobs` rows were claimed with a lease by `locked_by`; here the visibility timeout plus `job_touch` is the lease and the fenced claim
is the guard against a zombie worker's writes. Work that used `engine_enqueue(p_dedupe_key)` keeps its key as the dedupe key.
