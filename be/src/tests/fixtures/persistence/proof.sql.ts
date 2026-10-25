import { sql } from "@modules/platform/database"
export const OUTBOX = sql`
    SELECT id, sent_at FROM public.job_outbox
    WHERE queue = 'content_tick' AND payload->>'proofId' = $1
`
export const MESSAGES = sql`
    SELECT o.id::text AS id, o.attempts AS attempt,
           jsonb_build_object('name', o.name, 'payload', o.payload, 'dedupe', o.dedupe_key, 'outbox_id', o.id) AS message
    FROM public.job_outbox o
    WHERE o.queue = 'content_tick' AND o.payload->>'proofId' = $1
`
export const JOB = sql`SELECT id, status, fencing_token::text, current_step, error FROM public.jobs WHERE job_key = $1`
export const CLEAN_JOBS = sql`DELETE FROM public.jobs WHERE starts_with(job_key, $1)`
export const CLEAN_WORKSPACE = sql`DELETE FROM public.workspaces WHERE id = $1`
export const CLEAN_USER = sql`DELETE FROM auth.users WHERE id = $1`
export const RECEIPTS = sql`
    SELECT id, payload, processed_at FROM public.meta_inbox
    WHERE provider = 'meta' AND delivery_id = $1
`
export const WEBHOOK_JOBS = sql`
    SELECT id, payload, dedupe_key, sent_at FROM public.job_outbox
    WHERE (queue = 'meta_inbound' AND payload->'event'->>'mid' = $1)
       OR (queue = 'meta-delivery' AND payload->>'deliveryId' = $1)
`
export const WEBHOOK_MESSAGES = sql`
    SELECT jsonb_build_object('name', o.name, 'payload', o.payload, 'dedupe', o.dedupe_key, 'outbox_id', o.id) AS message
    FROM public.job_outbox o
    WHERE (o.queue = 'meta_inbound' AND o.payload->'event'->>'mid' = $1)
       OR (o.queue = 'meta-delivery' AND o.payload->>'deliveryId' = $1)
`
export const CLEAN_RECEIPT = sql`DELETE FROM public.meta_inbox WHERE provider = 'meta' AND delivery_id = $1`
export const CLEAN_WEBHOOK_MESSAGES = sql`
    WITH receipt AS (
        SELECT delivery_id FROM public.meta_inbox
        WHERE payload->'entry'->0->'messaging'->0->'message'->>'mid' = $1
    ), removed AS (
        DELETE FROM public.job_outbox
        WHERE queue = 'meta-delivery' AND payload->>'deliveryId' IN (SELECT delivery_id FROM receipt)
    )
    DELETE FROM public.job_outbox WHERE queue = 'meta_inbound' AND payload->'event'->>'mid' = $1
`
export const CLEAN_WEBHOOK_JOBS = sql`
    DELETE FROM public.job_outbox
    WHERE (queue = 'meta_inbound' AND payload->'event'->>'mid' = $1)
       OR (queue = 'meta-delivery' AND payload->>'deliveryId' IN (
           SELECT delivery_id FROM public.meta_inbox
           WHERE payload->'entry'->0->'messaging'->0->'message'->>'mid' = $1
       ))
`
export const CLEAN_MESSAGES = sql`DELETE FROM public.job_outbox WHERE queue = 'content_tick' AND payload->>'proofId' = $1`
export const CLEAN_OUTBOX = sql`DELETE FROM public.job_outbox WHERE queue = 'content_tick' AND payload->>'proofId' = $1`
export const CRON = sql`SELECT schedule, command FROM cron.job WHERE jobname = 'content-tick'`
export const LOCK_TICKS = sql`LOCK TABLE public.job_outbox IN ACCESS EXCLUSIVE MODE`
export const HIDE_TICKS = sql`UPDATE public.job_outbox SET sent_at = now() WHERE queue = 'content_tick' AND sent_at IS NULL`
export const TICK_IDS = sql`SELECT o.id::text AS id, o.queue, o.name, o.payload FROM public.job_outbox o WHERE o.queue = 'content_tick' AND o.sent_at IS NULL ORDER BY o.created_at`
export const FIRE_TICK = sql`DO $proof$
DECLARE tick text;
BEGIN
    SELECT command INTO STRICT tick FROM cron.job WHERE jobname = 'content-tick';
    EXECUTE tick;
END $proof$`
