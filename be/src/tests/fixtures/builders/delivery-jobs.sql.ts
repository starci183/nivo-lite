import { sql } from "@modules/platform/database"

/** Reads all provider receipt states without changing their owning services. */
export const RECEIPTS = sql`
    SELECT id, payload, processed_at FROM public.meta_inbox WHERE $1 = 'meta' AND provider = 'meta' AND delivery_id = $2
    UNION ALL
    SELECT id, payload, processed_at FROM public.telegram_inbox WHERE $1 = 'telegram' AND provider = 'telegram' AND delivery_id = $2
    UNION ALL
    SELECT id, payload, processed_at FROM public.sepay_transactions WHERE $1 = 'sepay' AND sepay_id::text = $2
`
/** Observes the durable publication from outside its intake transaction. */
export const PUBLICATIONS = sql`SELECT id, payload, dedupe_key, sent_at FROM public.job_outbox WHERE queue = $1 AND payload->>'deliveryId' = $2`
/** Observes the real pgmq handoff of each delivery capability. */
export const MESSAGES = sql`
    SELECT message FROM pgmq."q_meta-delivery" WHERE $1 = 'meta' AND message->'payload'->>'deliveryId' = $2
    UNION ALL
    SELECT message FROM pgmq."q_telegram-delivery" WHERE $1 = 'telegram' AND message->'payload'->>'deliveryId' = $2
    UNION ALL
    SELECT message FROM pgmq."q_sepay-delivery" WHERE $1 = 'sepay' AND message->'payload'->>'deliveryId' = $2
`
/** Removes only this delivery's queue messages, before removing its outbox. */
export const CLEAN_MESSAGES = sql`
    WITH meta AS (DELETE FROM pgmq."q_meta-delivery" WHERE $1 = 'meta' AND message->'payload'->>'deliveryId' = $2),
    telegram AS (DELETE FROM pgmq."q_telegram-delivery" WHERE $1 = 'telegram' AND message->'payload'->>'deliveryId' = $2)
    DELETE FROM pgmq."q_sepay-delivery" WHERE $1 = 'sepay' AND message->'payload'->>'deliveryId' = $2
`
/** Removes only the publication paired with this fixture receipt. */
export const CLEAN_PUBLICATIONS = sql`DELETE FROM public.job_outbox WHERE queue = $1 AND payload->>'deliveryId' = $2`
/** Removes only this fixture's durable receipt. */
export const CLEAN_RECEIPTS = sql`
    WITH meta AS (DELETE FROM public.meta_inbox WHERE $1 = 'meta' AND provider = 'meta' AND delivery_id = $2),
    telegram AS (DELETE FROM public.telegram_inbox WHERE $1 = 'telegram' AND provider = 'telegram' AND delivery_id = $2)
    DELETE FROM public.sepay_transactions WHERE $1 = 'sepay' AND sepay_id::text = $2
`
/** Removes reconcile messages before their workspace's booked credit is deleted. */
export const CLEAN_CREDITS = sql`
    WITH messages AS (DELETE FROM pgmq.q_bank_credit_received WHERE message->'payload'->>'workspaceId' = $1)
    DELETE FROM public.job_outbox WHERE queue = 'bank_credit_received' AND payload->>'workspaceId' = $1
`
