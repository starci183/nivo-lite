# Operating the job system

Job queues use BullMQ on the deployment's declared Redis. PostgreSQL retains the transactional outbox, attempts, workspace leases,
fenced claims and failure history. The relay publishes committed rows under their outbox UUID; the event bus continues to use pgmq.
Handler contracts and settings are in [the jobs guide](../guides/jobs.md).

## Redis cutover

The migration chain expands and moves data before contracting the old job API:

1. `db/migrations/20261104235900_queue-cutover.sql` locks the outbox and the known job queues and archives. It converts queued and in-flight pgmq
   messages into canonical outbox rows, keeping an existing outbox UUID or deriving a stable UUID for a raw message that had none.
   Existing outbox work without a broker copy is made eligible for publication. Archived dead messages retain failed outbox evidence.
2. The migration asserts that pending messages have durable outbox representation before deleting their pending pgmq copies. Archives
   remain available as historical evidence. Event bus pgmq queues and messages are outside the job queue move.
3. During the transition between migration files, redirect triggers and compatibility functions turn old pgmq job sends into outbox
   writes. Old job settlement cannot mark migrated work completed. Existing fenced claims protect effects if a delivery overlaps the
   cutover.
4. `db/migrations/20261105000000_queue-bullmq_contract_pgmq-drop.sql` installs the BullMQ admission, relay, repair and settlement functions, moves recurring job
   schedules to `job_enqueue`, then drops the old pgmq job read and settlement functions after the move.

For a controlled deploy, stop admission to old consumers and let their in-flight deliveries settle before applying the migration
chain. Keep the declared Redis ready with a sized positive `maxmemory` and explicit `maxmemory-policy noeviction`. Apply the complete
migration chain before starting the BullMQ API. The database move also preserves work if an old sender overlaps the transition; a
rolling update is not a substitute for checking completion of the migration chain.

The release lane owns deployment stack changes, Redis sizing and alert configuration. Monitor Redis memory pressure and rejected
writes alongside outbox queued age and failure counts. Do not allow Redis to evict job keys to make room: failed publication must
leave the PostgreSQL row pending for retry.

After startup, verify that `public_api` has its named and legacy consumers, relay publication advances, and the oldest queued age
falls. The cutover integration proof seeds queued, in-flight and archived-dead pgmq jobs before migration and checks their durable
identity and publication after the move.

## Watch

The API's in-process job monitor reads `job_stats()` independently of queue consumers. It logs and records alerts for excessive
failed jobs and stale queued work. Defaults are `JOBS_ALERT_FAILED_MAX=20` and `JOBS_ALERT_STALE_SECONDS=300`; alert scans run at
`JOBS_ALERT_INTERVAL` and suppress repeats per kind for 30 minutes.

Redis errors use the application Logger. The transport validates Redis memory policy before publishing or starting workers.
Producer connections disable offline buffering and use 5 s connection and command deadlines. Relay and repair calls run outside
PostgreSQL transactions, so Redis downtime cannot leave those transactions holding outbox locks.

## Inspect jobs

The existing operator commands resolve the API task and execute the CLI through its application database role:

```bash
starci app stack jobs stats --env production
starci app stack jobs failed --env production
starci app stack jobs failed 100 --env production
starci app stack jobs open --env production
```

The durable record is authoritative for operator inspection:

```sql
select public.job_stats();
select id, name, state, attempts, last_error, created_at
from public.job_outbox
where state in ('queued', 'running')
order by created_at;
select id, name, attempts, finished_at, last_error
from public.job_outbox
where state = 'failed'
order by finished_at desc
limit 20;
```

Completed broker copies expire after one hour and failed copies after seven days. Failure history remains in PostgreSQL after the
Redis copy expires. A retained pgmq archive is historical cutover evidence, not the live job transport.

## Retry

```bash
starci app stack jobs retry <outbox-id> --execute
starci app stack jobs retry-failed [hours] --execute
```

`job_reopen` resets attempts on the failed outbox row and requests explicit republishing under the same UUID. The relay removes or
retries the retained failed BullMQ job before publishing with a fresh broker budget; a plain add of an existing failed ID would do
nothing. No new outbox identity is minted.

Fix the cause before retrying. Handlers and fenced claims make repeated delivery safe, but a revoked credential or provider outage
will fail again until corrected. For a document, prefer its owner's Retry action or `knowledge_retry_source`, which also resets the
visible source status.

Set `QUEUE_ENABLED=false` to stop workers and relay while producers continue committing outbox rows. Work remains durable until a
consumer is enabled again.

## Recovery and shutdown

A crashed delivery is recovered after its broker lock and durable lease expire. `job_start` re-admits an expired running row instead
of completing it without invoking its handler. A live foreign fenced claim delays delivery; a completed fenced claim remains an
idempotent success. Late lease and settle writes require the unique admission token and cannot affect a newer delivery, including after
an operator resets the attempt count.

Reconciliation uses bounded claims with `SKIP LOCKED`, schedules future checks for rows still waiting or running, and shares work
across queues. It republishes missing or failed broker copies under the same UUID. Each row's error is logged independently. Do not
mark a running row done merely because a broker copy is completed or absent: neither proves successful domain processing.

Shutdown pauses fetching at drain start and lets in-flight work finish for `QUEUE_SHUTDOWN_GRACE` (default 30 s). It then aborts
remaining handlers and gives settlement another 5 s. Aborted starts are handed back without spending an attempt; genuine failures
during drain keep their accounting. Workers close only after settlement, without force. If a handler ignores abort and remains
unsettled, close rejects and logs the deadline failure while leaving its resources open.

## Local proof

Run integration checks against a private local Supabase database and a private Redis instance on free loopback ports. Set Redis
`maxmemory` and `maxmemory-policy noeviction` explicitly, use an isolated queue prefix, and remove only the containers created for
the proof. The scoped integration suites cover queue recovery, retry delay, relay repair, webhooks, public API processing, cron and
the pre-migration cutover data move.
