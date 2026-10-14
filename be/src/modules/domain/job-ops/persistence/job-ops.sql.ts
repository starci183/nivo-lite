import { sql } from "@modules/platform/database"

/** Reads statistics through the function already granted to app_be. */
export const READ_JOB_STATS = sql`SELECT public.job_stats() AS stats LIMIT 1`

/** Reads failed jobs through the function granted to app_be ($1 row limit), bounded by the platform list cap. */
export const READ_FAILED_JOBS = sql`SELECT * FROM public.job_failed($1::int) LIMIT 500`

/** Reads queued and running jobs through the function granted to app_be ($1 row limit), bounded by the platform list cap. */
export const READ_OPEN_JOBS = sql`SELECT * FROM public.job_open($1::int) LIMIT 500`

/** Requeues one failed outbox job ($1 UUID), preserving the bigint message id as text. */
export const REQUEUE_JOB = sql`SELECT public.job_requeue($1::uuid)::text AS message_id LIMIT 1`

/** Requeues failed jobs through the function granted to app_be ($1 time window in hours). */
export const REQUEUE_FAILED_JOBS = sql`SELECT public.job_requeue_failed($1::int) AS result LIMIT 1`
