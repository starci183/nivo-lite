import { sql } from "@modules/platform/database"
export const OUTBOX = sql`
    SELECT id, sent_at FROM public.job_outbox
    WHERE queue = 'content_tick' AND payload->>'proofId' = $1
`
export const MESSAGES = sql`
    SELECT msg_id, 1 AS attempt, message FROM pgmq.q_content_tick
    WHERE message->'payload'->>'proofId' = $1
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
    SELECT message FROM pgmq.q_meta_inbound WHERE message->'payload'->'event'->>'mid' = $1
    UNION ALL
    SELECT message FROM pgmq."q_meta-delivery" WHERE message->'payload'->>'deliveryId' = $1
`
export const CLEAN_RECEIPT = sql`DELETE FROM public.meta_inbox WHERE provider = 'meta' AND delivery_id = $1`
export const CLEAN_WEBHOOK_MESSAGES = sql`
    WITH receipt AS (
        SELECT delivery_id FROM public.meta_inbox
        WHERE payload->'entry'->0->'messaging'->0->'message'->>'mid' = $1
    ), removed AS (
        DELETE FROM pgmq."q_meta-delivery"
        WHERE message->'payload'->>'deliveryId' IN (SELECT delivery_id FROM receipt)
    )
    DELETE FROM pgmq.q_meta_inbound WHERE message->'payload'->'event'->>'mid' = $1
`
export const CLEAN_WEBHOOK_JOBS = sql`
    DELETE FROM public.job_outbox
    WHERE (queue = 'meta_inbound' AND payload->'event'->>'mid' = $1)
       OR (queue = 'meta-delivery' AND payload->>'deliveryId' IN (
           SELECT delivery_id FROM public.meta_inbox
           WHERE payload->'entry'->0->'messaging'->0->'message'->>'mid' = $1
       ))
`
export const CLEAN_MESSAGES = sql`DELETE FROM pgmq.q_content_tick WHERE message->'payload'->>'proofId' = $1`
export const CLEAN_OUTBOX = sql`DELETE FROM public.job_outbox WHERE queue = 'content_tick' AND payload->>'proofId' = $1`
export const CRON = sql`SELECT schedule, command FROM cron.job WHERE jobname = 'content-tick'`
export const LOCK_TICKS = sql`LOCK TABLE pgmq.q_content_tick IN ACCESS EXCLUSIVE MODE`
export const HIDE_TICKS = sql`UPDATE pgmq.q_content_tick SET vt = now() + interval '1 day'`
export const TICK_IDS = sql`SELECT msg_id::text AS id FROM pgmq.q_content_tick ORDER BY msg_id`
export const FIRE_TICK = sql`DO $proof$
DECLARE tick text;
BEGIN
    SELECT command INTO STRICT tick FROM cron.job WHERE jobname = 'content-tick';
    EXECUTE tick;
END $proof$`
