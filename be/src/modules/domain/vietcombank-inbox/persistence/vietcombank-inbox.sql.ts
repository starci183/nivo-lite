import { sql } from "@modules/platform/database"

/** Claims one simulated bank receipt using the same provider-prefixed bank event identity as booking. */
export const INSERT_VIETCOMBANK_INBOX = sql`INSERT INTO public.vietcombank_inbox (provider, delivery_id, payload)
VALUES ($1, $2, $3::jsonb)
ON CONFLICT (provider, delivery_id) DO NOTHING
RETURNING id`
/** Locks a committed receipt before the deferred booking. */
export const FIND_PENDING_VIETCOMBANK_INBOX = sql`SELECT id, payload FROM public.vietcombank_inbox
WHERE provider = 'vietcombank' AND delivery_id = $1 AND processed_at IS NULL
LIMIT 1
FOR UPDATE`
/** Completes a receipt atomically with its booking and reconcile job. */
export const COMPLETE_VIETCOMBANK_INBOX = sql`UPDATE public.vietcombank_inbox
SET processed_at = now()
WHERE id = $1`
