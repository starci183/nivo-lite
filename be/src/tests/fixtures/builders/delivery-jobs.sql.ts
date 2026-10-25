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
/** The broker-bound envelope of each delivery capability, reconstructed from the outbox the relay publishes. */
export const MESSAGES = sql`
    SELECT jsonb_build_object('name', o.name, 'payload', o.payload, 'dedupe', o.dedupe_key, 'outbox_id', o.id) AS message
    FROM public.job_outbox o
    WHERE (($1 = 'meta' AND o.queue = 'meta-delivery')
        OR ($1 = 'telegram' AND o.queue = 'telegram-delivery')
        OR ($1 = 'sepay' AND o.queue = 'sepay-delivery'))
      AND o.payload->>'deliveryId' = $2
`
/** Removes only this delivery's broker-bound rows, before removing its outbox. */
export const CLEAN_MESSAGES = sql`
    DELETE FROM public.job_outbox
    WHERE (($1 = 'meta' AND queue = 'meta-delivery')
        OR ($1 = 'telegram' AND queue = 'telegram-delivery')
        OR ($1 = 'sepay' AND queue = 'sepay-delivery'))
      AND payload->>'deliveryId' = $2
`
/** Removes only the publication paired with this fixture receipt. */
export const CLEAN_PUBLICATIONS = sql`DELETE FROM public.job_outbox WHERE queue = $1 AND payload->>'deliveryId' = $2`
/** Removes only this fixture's durable receipt. */
export const CLEAN_RECEIPTS = sql`
    WITH meta AS (DELETE FROM public.meta_inbox WHERE $1 = 'meta' AND provider = 'meta' AND delivery_id = $2),
    telegram AS (DELETE FROM public.telegram_inbox WHERE $1 = 'telegram' AND provider = 'telegram' AND delivery_id = $2)
    DELETE FROM public.sepay_transactions WHERE $1 = 'sepay' AND sepay_id::text = $2
`
/** Removes reconcile rows before their workspace's booked credit is deleted. */
export const CLEAN_CREDITS = sql`
    DELETE FROM public.job_outbox WHERE queue = 'bank_credit_received' AND payload->>'workspaceId' = $1
`
