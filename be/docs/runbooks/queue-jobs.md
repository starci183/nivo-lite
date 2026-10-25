# Queue and fenced jobs

Background jobs use BullMQ on the deployment's declared Redis. PostgreSQL owns the transactional outbox, workspace slots,
attempt count and failure history. The event bus continues to use pgmq; job queue cutover does not move event bus messages.

- `modules/platform/queue`: `QueueOutbox`, the committed-row relay, BullMQ transport, worker registry and status.
- `modules/platform/jobs`: the durable fenced claim (`public.jobs`) under which each `FencedProcessor` runs.

## The wire

| Step           | Function / component | Behavior                                                                                                                   |
| -------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Enqueue        | `job_enqueue`        | Commits one outbox row with the business change; a dedupe key retains one row.                                             |
| Publish        | relay + BullMQ       | Claims a short database lease, commits it, then adds the job under the outbox UUID outside the transaction.                |
| Admit          | `job_start`          | Counts a real start and claims a workspace slot; a live slot defers delivery. An expired running delivery can start again. |
| Renew          | `job_lease`          | Renews the current attempt's workspace lease while the handler runs.                                                       |
| Done           | `job_done`           | Settles the successful current delivery under its unique admission token.                                                  |
| Retry          | `job_retry` + BullMQ | Records the error and retries after a hint or the default backoff.                                                         |
| Dead           | `job_dead`           | Records terminal failure durably; the processor's failure hook records the owner-facing failure.                           |
| Recover        | reconcile            | Claims due rows with `SKIP LOCKED`, checks Redis outside the transaction, and repairs missing or failed broker copies.     |
| Operator retry | `job_requeue`        | Resets the failed row's budget and requests explicit republishing under the same UUID.                                     |

Publication and reconciliation use leases so a slow or crashed replica does not permanently own rows. Checked rows get a next-check
time and reconciliation shares work across queues. One row's error is logged without preventing later rows from being checked.
Redis calls have finite producer deadlines and never hold a PostgreSQL transaction open.

`app_be` reaches the durable queue through definer functions; outbox and slot tables remain closed to it. A valid `workspaceId` in the
payload counts against `QUEUE_WORKSPACE_CONCURRENCY` across replicas. A write without a dedupe key gets a fresh identity; repeating a
dedupe key retains the existing outbox UUID, which is also the BullMQ job ID and fenced job key.

Delivery within a queue is unordered. Concurrent relays, retries and busy-workspace deferrals can reorder jobs. A future handler that
needs per-key order must carry a sequence and enforce it under the fence.

## Adding a queue

1. Add typed contracts and a producer in `modules/queues/<queue>/`; use `outbox.write(tx, queue, payload, { job, dedupeKey })` in the
   caller's transaction. New BullMQ job queues do not need `pgmq.create`.
2. Add a `FencedProcessor` and its steps in `features/jobs/<job>/`. Re-read current business state and make effects idempotent.
3. Register its queue module with the `JobProcessorRegistry` in the API composition. A missing job handler is an unrecoverable error.
4. Add recurring work through a migration-owned pg_cron schedule that calls `job_enqueue`; it must not send raw pgmq job messages.

The `public_api` queue registers both `public-api.request` and its historical implicit `public_api` job name through the same fenced
fulfillment lifecycle.

## Failure and shutdown

There are four real attempts. Ordinary failures use 5 s, 10 s and 20 s backoff; the custom BullMQ backoff type honors `QueueError`
`RetryAfter` and supported domain retry hints. `Unrecoverable` and missing handlers end immediately. A live foreign fenced claim
defers delivery instead of acknowledging work that has not finished.

Shutdown pauses fetching immediately. Existing deliveries get `QUEUE_SHUTDOWN_GRACE`, then receive an abort signal and have a further
5 s to settle. A delivery fetched during drain is delayed before admission. An aborted admitted delivery is handed back without
spending an attempt; an ordinary failure during drain still counts. Workers and queues close only after deliveries settle. If a handler
does not settle by the deadline, close rejects and logs the failure, leaving the resources open rather than force-closing active work.

The heartbeat is cleared even when a handler throws synchronously. Lease and settle writes carry a unique admission token, independent
of the attempt count, so a late worker cannot settle a newer delivery even after an operator resets attempts. Fenced domain effects
retain their own token checks.

## Redis requirements

Use a finite, sized `maxmemory` and explicitly select `maxmemory-policy noeviction`. The transport checks Redis memory information
before publishing or starting a worker and refuses a Redis instance without both requirements. Redis connection errors go through the
application Logger. Queue producer connections disable offline buffering and bound connection and command waits to 5 s.

Completed broker copies are retained for one hour and failed copies for seven days. PostgreSQL keeps the durable failure history and
operator retry explicitly republishes the retained identity; retry does not depend on retaining a failed Redis copy.

Cutover and operational checks are in [jobs-operations.md](jobs-operations.md); handler contracts and settings are in
[../guides/jobs.md](../guides/jobs.md).
