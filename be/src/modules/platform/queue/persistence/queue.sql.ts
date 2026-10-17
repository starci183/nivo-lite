import { sql } from "@modules/platform/database"

/** Reads one job's authoritative state through the backend-only function ($1 workspace, $2 queue, $3 dedupe key). */
export const JOB_STATUS = sql`SELECT id, state, attempts FROM public.job_status($1::uuid, $2::text, $3::text) LIMIT 1`

/**
 * Writes the outbox row of a job and sends its pgmq message on the connection of the caller's transaction, idempotent on the dedupe
 * key ($1 workspace or null, $2 queue, $3 job, $4 payload, $5 dedupe key, or null for a fresh `<job>:<uuid>`); an existing key
 * answers its row and sends nothing.
 */
export const JOB_ENQUEUE = sql`SELECT public.job_enqueue($1::uuid, $2, $3, $4::jsonb, COALESCE($5::text, $3 || ':' || gen_random_uuid()::text)) AS id`

/**
 * Reads at most $3 messages of the queue $1 and hides them from other readers for $2 seconds; a message whose workspace already runs
 * $4 jobs is deferred a few seconds and not returned (job_slots keeps the per-workspace count across every app replica).
 */
export const JOB_READ = sql`SELECT msg_id, attempt, message FROM public.job_read($1, $2, $3, $4) LIMIT $3`

/** Keeps a running message hidden for $3 more seconds and its workspace slot leased as long ($1 queue, $2 message id). */
export const JOB_TOUCH = sql`SELECT public.job_touch($1, $2::bigint, $3) AS touched`

/** Done: deletes the message, frees the slot and closes the outbox row ($1 queue, $2 message id). */
export const JOB_ACK = sql`SELECT public.job_ack($1, $2::bigint) AS acked`

/** Retry later: the message is visible again after $3 seconds and the slot is freed meanwhile ($1 queue, $2 message id, $4 reason). */
export const JOB_FAIL = sql`SELECT public.job_fail($1, $2::bigint, $3, $4) AS failed`

/** Failed for good: moves the message to the archive of its queue and keeps the reason on the outbox row ($1 queue, $2 message id, $3 reason). */
export const JOB_ARCHIVE = sql`SELECT public.job_archive($1, $2::bigint, $3) AS archived`
