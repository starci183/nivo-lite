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

`app_be` holds execute on exactly these functions (`supabase/migrations/_archive/20261012123100_be-queue-grants.sql`); `job_outbox` and `job_slots` stay closed to it.
A job whose payload carries `workspaceId` (a uuid) counts against that workspace's limit. A write without a dedupe key gets a fresh
`<job>:<uuid>`; with one, the same key twice is one job (the unique `job_outbox.dedupe_key`).

## Adding a queue

1. A migration: `select pgmq.create('<queue>')` (the `pgmq` schema is never exposed to clients).
2. `modules/queues/<queue>/`: `<queue>.contracts.ts` (job names, payloads, dedupe keys), `<queue>.queue.ts` (the typed producer calling
   `outbox.write(tx, QUEUE, payload, { job, dedupeKey })`), `<queue>.module.ts` and the barrel file. `be/src/modules/queues/knowledge` is the first.
3. `features/jobs/<job>/`: a `FencedProcessor` with `queue` and `job`, steps that advance under the claimed token, and the queue module that
   hands the processor to the `JobProcessorRegistry`. Several jobs may share a queue; each gets its own processor.
4. A schedule is a `QueueSchedulerDefinition` in the scheduler list (`be/apps/api/src/compose/schedulers.ts`); the api upserts it as a pg_cron job by id at boot, once per interval.

## Errors a handler can throw

| Throw                                        | Effect                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| anything else                                | retried with backoff until the attempts are used up, then archived         |
| `QueueError` code `Unrecoverable` (`reason`) | archived at once; `reason` is kept on the outbox row                       |
| `QueueError` code `RetryAfter` (`seconds`)   | retried after those seconds (still archived once the attempts are used up) |

When a job ends as failed, `onFailed(delivery, cause)` of its processor runs once (write the failure the owner sees there).
The knowledge queue's out-of-credits case is Unrecoverable with reason `blocked_credits` (the blocked-credits constant of `be/src/modules/queues/knowledge/knowledge.contracts.ts`).
