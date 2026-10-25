import { sql } from "@modules/platform/database"

/** A real broker proof's durable admission and settlement. */
export const REDIS_JOB = sql`SELECT id, queue, name, payload, state, attempts FROM public.job_outbox
WHERE dedupe_key = $1`

/** The accepted public API request's durable broker identity. */
export const API_REDIS_JOB = sql`SELECT id, state FROM public.job_outbox
WHERE queue = 'public_api' AND payload->>'requestId' = $1`

/** Only the proof's isolated admission is removed. */
export const CLEAN_REDIS_JOB = sql`DELETE FROM public.job_outbox WHERE dedupe_key = $1`

/** Models the persisted lease left by a crashed holder, without changing its admitted identity. */
export const LAPSE_REDIS_JOB = sql`UPDATE public.job_outbox SET run_lease_until = now() - interval '1 second' WHERE id = $1::uuid`

/** An operator's actual retry door, under the same outbox id. */
export const REQUEUE_REDIS_JOB = sql`SELECT public.job_reopen($1::uuid)`
