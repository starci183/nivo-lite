import { sql } from "@modules/platform/database"

/** Reads one job's authoritative state through the backend-only function ($1 workspace, $2 queue, $3 dedupe key). */
export const JOB_STATUS = sql`SELECT id, state, attempts FROM public.job_status($1::uuid, $2::text, $3::text) LIMIT 1`

/**
 * Writes the durable outbox row of a job inside the transaction of the caller, idempotent on the dedupe key
 * ($1 workspace or null, $2 queue, $3 job, $4 payload, $5 dedupe key, or null for a fresh `<job>:<uuid>`); an existing
 * key answers its row. Nothing reaches Redis inside the caller's transaction: the relay publishes committed rows.
 */
export const JOB_ENQUEUE = sql`SELECT public.job_enqueue($1::uuid, $2, $3, $4::jsonb, COALESCE($5::text, $3 || ':' || gen_random_uuid()::text)) AS id`

/**
 * Claims at most $1 committed outbox rows still waiting for Redis ($1 batch size), oldest first, locked for the
 * duration of the caller's transaction so a second relay skips them.
 */
export const JOB_RELAY_CLAIM = sql`SELECT id, queue, name, payload FROM public.job_relay_claim($1::int) LIMIT $1::int`

/** Marks the relayed rows as sent ($1 outbox row ids): a crash before this mark re-adds them, which BullMQ dedupes on the row id. */
export const JOB_RELAY_SENT = sql`SELECT public.job_relay_sent($1::uuid[]) AS marked`

/**
 * Reads at most $3 nonterminal outbox rows worth checking against Redis ($1 seconds a queued row may stay sent without
 * a delivery, $2 seconds a running row may go silent): queued rows the relay may have lost and running rows whose
 * worker may have died.
 */
export const JOB_RECONCILE = sql`SELECT id, queue, name, payload, state FROM public.job_reconcile($1::int, $2::int, $3::int) LIMIT $3::int`

/**
 * Starts one delivery ($1 queue, $2 outbox row id, $3 per-workspace limit, $4 slot lease in seconds): counts the real
 * start and takes the workspace slot, answers 'busy' when the workspace is at the limit (the start does not count),
 * 'terminal' when the row already ended and 'missing' when there is no row.
 */
export const JOB_START = sql`SELECT outcome, attempt FROM public.job_start($1, $2::uuid, $3::int, $4::int) LIMIT 1`

/** Renews the workspace slot of a running delivery for $2 more seconds ($1 outbox row id). */
export const JOB_LEASE = sql`SELECT public.job_lease($1::uuid, $2::int) AS leased`

/** Done: frees the slot and closes the outbox row ($1 outbox row id). */
export const JOB_DONE = sql`SELECT public.job_done($1::uuid) AS done`

/** Retry later through the broker: frees the slot and keeps the reason on the row ($1 outbox row id, $2 reason). */
export const JOB_RETRY = sql`SELECT public.job_retry($1::uuid, $2) AS retried`

/** Failed for good: frees the slot and keeps the reason on the outbox row ($1 outbox row id, $2 reason). */
export const JOB_DEAD = sql`SELECT public.job_dead($1::uuid, $2) AS dead`

/** A running row whose worker is gone goes back to queued and frees its slot ($1 outbox row id). */
export const JOB_RESET = sql`SELECT public.job_reset($1::uuid) AS reset`
