import { sql } from "@modules/platform/database"

/** Reads one job's authoritative state through the backend-only function ($1 workspace, $2 queue, $3 dedupe key). */
export const JOB_STATUS = sql`SELECT id, state, attempts FROM public.job_status($1::uuid, $2::text, $3::text) LIMIT 1`

/** Writes an idempotent durable outbox row in the caller transaction; the relay publishes only committed rows. */
export const JOB_ENQUEUE = sql`SELECT public.job_enqueue($1::uuid, $2, $3, $4::jsonb, COALESCE($5::text, $3 || ':' || gen_random_uuid()::text)) AS id LIMIT 1`

/** Leases a fair SKIP LOCKED batch ($1 size, $2 lease seconds) in one short database statement. */
export const JOB_RELAY_CLAIM = sql`SELECT id, queue, name, payload, lease_token, retry_requested FROM public.job_relay_claim($1::int, $2::int) LIMIT $1::int`

/** Marks one published row only while its relay claim is current ($1 id, $2 token, $3 seconds until reconciliation). */
export const JOB_RELAY_SENT = sql`SELECT public.job_relay_sent($1::uuid, $2::uuid, $3::int) AS marked LIMIT 1`

/** Releases one current claim, preserving the next due check assigned when the row was claimed. */
export const JOB_RELAY_RELEASE = sql`SELECT public.job_relay_release($1::uuid, $2::uuid) AS released LIMIT 1`

/** Leases a fair due SKIP LOCKED batch ($1 queued stale, $2 running stale, $3 size, $4 lease seconds). */
export const JOB_RECONCILE = sql`SELECT id, queue, name, payload, state, attempts, run_token, lease_token, retry_requested FROM public.job_reconcile($1::int, $2::int, $3::int, $4::int) LIMIT $3::int`

/** Admits a start or an expired running lease ($1 queue, $2 id, $3 workspace limit, $4 lease seconds). */
export const JOB_START = sql`SELECT outcome, attempt, state, run_token FROM public.job_start($1, $2::uuid, $3::int, $4::int) LIMIT 1`

/** Renews only the current start ($1 id, $2 lease seconds, $3 admission token). */
export const JOB_LEASE = sql`SELECT public.job_lease($1::uuid, $2::int, $3::uuid) AS leased LIMIT 1`

/** Completes only a running current start ($1 id, $2 admission token). */
export const JOB_DONE = sql`SELECT public.job_done($1::uuid, $2::uuid) AS done LIMIT 1`

/** Releases the current start for a broker retry ($1 id, $2 reason, $3 admission token). */
export const JOB_RETRY = sql`SELECT public.job_retry($1::uuid, $2, $3::uuid) AS retried LIMIT 1`

/** Fails only the current start ($1 id, $2 reason, $3 admission token). */
export const JOB_DEAD = sql`SELECT public.job_dead($1::uuid, $2, $3::uuid) AS dead LIMIT 1`

/** Returns a genuinely aborted current start without spending its durable attempt ($1 id, $2 admission token). */
export const JOB_HANDBACK = sql`SELECT public.job_handback($1::uuid, $2::uuid) AS handed_back LIMIT 1`

/** Resets an orphan only under the current relay lease and admission token ($1 id, $2 token, $3 admission token). */
export const JOB_RESET = sql`SELECT public.job_reset($1::uuid, $2::uuid, $3::uuid) AS reset LIMIT 1`
