# Background jobs

Heavy work runs after the request commits. The request writes the business row and a `job_outbox` row in one PostgreSQL transaction,
then a relay publishes the committed job to BullMQ on the deployment's declared Redis. A rolled-back change cannot start work. Owner
decision A for v0.3.6 selects BullMQ for job queues; the event bus stays on pgmq.

## Where things live

| Piece                                                       | Path                                                               |
| ----------------------------------------------------------- | ------------------------------------------------------------------ |
| Outbox, relay, BullMQ transport, worker registry and status | `be/src/modules/platform/queue`                                    |
| Fenced claims and processor base                            | `be/src/modules/platform/jobs`                                     |
| Typed queue producers, names, payloads and dedupe keys      | `be/src/modules/queues/<queue>`                                    |
| Job processors and steps                                    | `be/src/features/jobs/<job>/{steps,transport/queue}`               |
| API processor registration                                  | `be/apps/api/src/compose/jobs.ts`                                  |
| Durable queue functions and recurring job schedules         | `db/migrations/20261105000000_queue-bullmq_contract_pgmq-drop.sql` |
| Operator commands                                           | `be/src/features/cli/jobs` and `starci app stack jobs`             |

## Delivery and recovery

`QueueOutbox.write(tx, queue, payload, { job, dedupeKey })` writes through `job_enqueue`. The relay claims a bounded batch with short
database leases and `SKIP LOCKED`, commits those claims, then calls Redis outside the transaction. The BullMQ ID is the outbox UUID;
repeating publication is idempotent. A failed publication leaves durable work for a later pass.

Before invoking a handler, `job_start` counts a real start and acquires a leased workspace slot. A busy workspace is deferred without
spending a try. A running row whose lease expired can be admitted again; `done` and `failed` are terminal. Heartbeats and settlement
are fenced by a unique admission token, independent of the resettable attempt count, so an old delivery cannot settle its successor.

`JobRunnerService` claims `public.jobs` under a fencing token before running a `FencedProcessor`. An already completed fenced job is
an idempotent no-op. A live foreign claim defers the queue delivery until it can be claimed; it must not complete an unfinished outbox
row. Domain effects and step writes use the claimed token.

Reconciliation checks due nonterminal rows against Redis, with separate leased claims across replicas, fair work across queues and a
next-check time for jobs still waiting, delayed or active. Missing or failed broker copies are republished under the same UUID. One
repair failure is logged and does not stop later rows. A completed broker copy alone is not proof that a handler ran successfully.

Delivery within each queue is unordered: relay replicas, retries and deferrals can reorder work. Jobs that need per-key ordering must
carry a sequence and enforce it under their fence.

Recurring jobs are owned by pg_cron migrations and call `job_enqueue`, with an occurrence dedupe key. They enter the same durable
outbox and BullMQ lifecycle as request-driven jobs. The event bus's pgmq queues remain separate.

## Retry policy and idempotency

- Four real attempts; default waits are 5 s, 10 s and 20 s. The custom BullMQ backoff strategy honors queue and supported domain retry
  hints instead of using a built-in backoff type that would bypass the hints.
- `QueueError` `Unrecoverable`, a missing handler, or an explicitly unrecoverable domain error ends immediately. The error and terminal
  state remain in PostgreSQL; the processor's failure hook records the owner-facing result.
- A crash-recovered delivery can run again after its lease expires. A settle-query failure must not turn that redelivery into success.
- Operator retry resets the failed row's attempts and explicitly republishes the same UUID with a fresh BullMQ retry budget. It does
  not rely on adding an ID that Redis still holds as failed.
- Shutdown pauses fetching first. After the grace period, aborted deliveries are handed back without consuming a try. Ordinary
  failures while draining still count. A handler that does not settle within the further 5 s deadline causes close to reject and log;
  active deliveries are never force-closed.

Handlers must re-read current state, return harmlessly for completed subjects, and replace or resume effects rather than append them
again. Chained jobs use a dedupe key derived from the subject and parent job. Credits are checked before spending; a blocked-credits
source waits for the owner's explicit retry.

Completed Redis copies last one hour, failed copies seven days. PostgreSQL remains the audit trail after Redis retention expires.

## Adding a job

1. Define names, ID-only payloads and dedupe-key builders in `modules/queues/<queue>/`, and expose a typed producer using the outbox.
   BullMQ job queues do not need a pgmq queue migration.
2. Produce the job in the transaction that commits its business change.
3. Add a `FencedProcessor` and steps under `features/jobs/<job>/`; keep effects idempotent and token-guarded.
4. Register its queue module in the API composition. Recurring jobs need a migration-owned pg_cron command calling `job_enqueue`.
5. A user-facing retry must enqueue through the owning job's outbox contract rather than run work inline.

The public API consumer registers both `public-api.request` and historical `public_api` job names, so accepted and legacy requests use
the same fenced processing path on BullMQ.

## Settings and operations

| Variable                       | Default         | Meaning                                                                             |
| ------------------------------ | --------------- | ----------------------------------------------------------------------------------- |
| `QUEUE_ENABLED`                | `true`          | Enables workers and relay; producers continue writing outbox rows when false.       |
| `QUEUE_REDIS_HOST`             | `localhost`     | Declared Redis host.                                                                |
| `QUEUE_REDIS_PORT`             | `6379`          | Redis port.                                                                         |
| `QUEUE_REDIS_DB`               | `0`             | Redis database.                                                                     |
| `QUEUE_REDIS_PREFIX`           | `nivo`          | BullMQ key prefix.                                                                  |
| `QUEUE_REDIS_PASSWORD`         | unset           | Optional Redis credential; configure only when the Redis server requires it.        |
| `QUEUE_CONCURRENCY`            | `4`             | Concurrent deliveries per queue per API, unless a processor asks for another limit. |
| `QUEUE_WORKSPACE_CONCURRENCY`  | `2`             | Slots per workspace across replicas.                                                |
| `QUEUE_RELAY_INTERVAL`         | `500ms`         | Pause after an empty relay pass.                                                    |
| `QUEUE_RELAY_BATCH`            | `50`            | Bounded relay and reconciliation batch size.                                        |
| `QUEUE_RECONCILE_AFTER`        | `15s`           | Initial stale-row check interval.                                                   |
| `QUEUE_VISIBILITY_TIMEOUT`     | `60s`           | Broker lock and workspace lease duration; leases renew every third of it.           |
| `QUEUE_SHUTDOWN_GRACE`         | `30s`           | Time existing deliveries get before shutdown abort.                                 |
| `JOBS_LEASE`, `JOBS_WORKER_ID` | `60s`, `worker` | Fenced claim lease and worker name.                                                 |
| `JOBS_SCHEDULER_ENABLED`       | `true`          | Whether this app fires the recurring ticks (the api does; one-off runs never).      |

Redis must have a finite positive `maxmemory` and explicit `maxmemory-policy noeviction`. The transport validates those settings
before publication or worker startup. Producer connections disable offline buffering and use 5 s connection and command deadlines.
Connection errors go through the application Logger.

Read `job_stats()`, `job_open()` and `job_failed()` through the existing operator commands. PostgreSQL queued age and failure alerts
remain the durable operational signal. Read [the jobs operations runbook](../runbooks/jobs-operations.md) before the pgmq-to-BullMQ
cutover or an operator retry.
