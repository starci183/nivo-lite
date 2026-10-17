import { sql } from "@modules/platform/database"
/** The receipt state owned by this proof's isolated delivery key. */
export const RECEIPTS = sql`SELECT id, payload, processed_at FROM public.telegram_inbox WHERE provider = 'telegram' AND delivery_id = $1`
/** The durable publication and dedupe identity committed with the receipt. */
export const JOBS = sql`SELECT id, payload, dedupe_key, sent_at FROM public.job_outbox WHERE queue = 'telegram-delivery' AND payload->>'deliveryId' = $1`
/** The actual pgmq handoff of the committed publication. */
export const MESSAGES = sql`SELECT message FROM pgmq."q_telegram-delivery" WHERE message->'payload'->>'deliveryId' = $1`
/** Removes only messages created by this proof. */
export const CLEAN_MESSAGES = sql`DELETE FROM pgmq."q_telegram-delivery" WHERE message->'payload'->>'deliveryId' = $1`
/** Removes only publication rows created by this proof. */
export const CLEAN_JOBS = sql`DELETE FROM public.job_outbox WHERE queue = 'telegram-delivery' AND payload->>'deliveryId' = $1`
/** Removes only the receipt created by this proof. */
export const CLEAN_RECEIPTS = sql`DELETE FROM public.telegram_inbox WHERE provider = 'telegram' AND delivery_id = $1`
