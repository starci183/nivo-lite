import { sql } from "@modules/platform/database"

/** Reads statistics through the function already granted to app_be. */
export const READ_JOB_STATS = sql`SELECT public.job_stats() AS stats LIMIT 1`

/** Reads failed jobs through the function granted to app_be ($1 row limit), bounded by the platform list cap. */
export const READ_FAILED_JOBS = sql`SELECT * FROM public.job_failed($1::int) LIMIT 500`

/** Reads queued and running jobs through the function granted to app_be ($1 row limit), bounded by the platform list cap. */
export const READ_OPEN_JOBS = sql`SELECT * FROM public.job_open($1::int) LIMIT 500`

/** Requeues one failed outbox job ($1 UUID): its broker identity is the outbox id itself, returned as text. */
export const REQUEUE_JOB = sql`SELECT public.job_reopen($1::uuid)::text AS message_id LIMIT 1`

/** Requeues failed jobs through the function granted to app_be ($1 time window in hours). */
export const REQUEUE_FAILED_JOBS = sql`SELECT public.job_requeue_failed($1::int) AS result LIMIT 1`

/** Deletes one bounded batch of finished system history through the function granted to app_be ($1 success days, $2 failure days, $3 batch rows). */
export const SWEEP_SYSTEM_HISTORY = sql`SELECT public.system_history_sweep($1::int, $2::int, $3::int) AS result LIMIT 1`
