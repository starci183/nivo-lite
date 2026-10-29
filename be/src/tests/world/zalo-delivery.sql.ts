import { sql } from "@modules/platform/database"
/** The durable publication and dedupe identity committed with the receipt. */
export const JOBS = sql`SELECT id, payload, dedupe_key, sent_at FROM public.job_outbox WHERE queue = 'zalo-delivery' AND payload->>'deliveryId' = $1`
/** The broker-bound envelope of the committed publication, reconstructed from the outbox. */
export const MESSAGES = sql`
    SELECT jsonb_build_object('name', o.name, 'payload', o.payload, 'dedupe', o.dedupe_key, 'outbox_id', o.id) AS message
    FROM public.job_outbox o
    WHERE o.queue = 'zalo-delivery' AND o.payload->>'deliveryId' = $1
`
/** Removes only broker-bound rows created by this proof. */
export const CLEAN_MESSAGES = sql`DELETE FROM public.job_outbox WHERE queue = 'zalo-delivery' AND payload->>'deliveryId' = $1`
/** Removes only publication rows created by this proof. */
export const CLEAN_JOBS = sql`DELETE FROM public.job_outbox WHERE queue = 'zalo-delivery' AND payload->>'deliveryId' = $1`
