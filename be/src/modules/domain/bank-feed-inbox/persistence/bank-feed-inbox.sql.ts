import { sql } from "@modules/platform/database"

/** Claims one connection-scoped provider delivery atomically with its queue message. */
export const INSERT_BANK_FEED_INBOX = sql`INSERT INTO public.bank_feed_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`
/** Locks a pending provider receipt for its deferred booking transaction. */
export const FIND_PENDING_BANK_FEED_INBOX = sql`SELECT id, payload FROM public.bank_feed_inbox
WHERE provider = $1 AND delivery_id = $2 AND processed_at IS NULL
LIMIT 1
FOR UPDATE`
/** Completes a receipt together with every credit and reconcile job it created. */
export const COMPLETE_BANK_FEED_INBOX = sql`UPDATE public.bank_feed_inbox SET processed_at = now() WHERE id = $1`
