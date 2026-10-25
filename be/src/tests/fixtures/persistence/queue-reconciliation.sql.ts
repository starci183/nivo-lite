import { sql } from "@modules/platform/database"

/** Seeds sent, due durable rows without contacting either broker; proof tags isolate cleanup. */
export const SEED_DUE_JOBS = sql`
    INSERT INTO public.job_outbox (queue, name, payload, dedupe_key, sent_at, created_at, reconcile_at)
    SELECT $2::text, $2::text, jsonb_build_object('proofId', $1::text), $1::text || ':' || n,
           now(), '2000-01-01'::timestamptz + make_interval(secs => n), '2000-01-01'::timestamptz
    FROM generate_series(1, $3::int) n
    RETURNING id
`
/** Removes the exact rows seeded by a reconciliation proof. */
export const CLEAN_RECONCILE_JOBS = sql`DELETE FROM public.job_outbox WHERE payload->>'proofId' = $1`
/** Holds one row to prove a second replica skips its lock rather than waiting behind it. */
export const LOCK_RECONCILE_JOB = sql`SELECT id FROM public.job_outbox WHERE id = $1::uuid FOR UPDATE`
/** Expires one current run lease, modeling a lost process without waiting for wall-clock time. */
export const EXPIRE_QUEUE_RUN = sql`UPDATE public.job_outbox SET run_lease_until = now() - interval '1 second' WHERE id = $1::uuid`
/** Requests an operator retry of a failed durable job. */
export const REQUEUE_PROOF_JOB = sql`SELECT public.job_requeue($1::uuid) AS id LIMIT 1`

/** Claims due checks using the public backend function. */
export const CLAIM_DUE_JOBS = sql`SELECT id, lease_token FROM public.job_reconcile($1::int, $2::int, $3::int, $4::int) LIMIT $3::int`
/** Attempts worker admission using the public backend function. */
export const START_QUEUE_RUN = sql`SELECT outcome, attempt, run_token FROM public.job_start($1, $2::uuid, $3::int, $4::int) LIMIT 1`
/** Fenced success settlement. */
export const COMPLETE_QUEUE_RUN = sql`SELECT public.job_done($1::uuid, $2::uuid) AS done LIMIT 1`
/** Fenced retry settlement. */
export const RETRY_QUEUE_RUN = sql`SELECT public.job_retry($1::uuid, $2, $3::uuid) AS retried LIMIT 1`
/** Fenced permanent failure settlement. */
export const FAIL_QUEUE_RUN = sql`SELECT public.job_dead($1::uuid, $2, $3::uuid) AS dead LIMIT 1`
/** Fenced lease renewal. */
export const RENEW_QUEUE_RUN = sql`SELECT public.job_lease($1::uuid, $2::int, $3::uuid) AS leased LIMIT 1`
/** Fenced shutdown handback. */
export const RETURN_QUEUE_RUN = sql`SELECT public.job_handback($1::uuid, $2::uuid) AS handed_back LIMIT 1`
