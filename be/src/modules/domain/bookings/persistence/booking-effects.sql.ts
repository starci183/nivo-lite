import { sql } from "@modules/platform/database"

/** One booking of a workspace with its service name, locked for the rest of the transaction ($1 workspace, $2 booking). */
export const SELECT_BOOKING_FOR_EFFECTS = sql`SELECT b.id, b.status, b.lead_id, b.conversation_id, b.customer_name, b.customer_phone, b.customer_email, b.origin,
       b.cancel_reason, b.reschedule_count, s.name AS service_name,
       b.price_vnd::float8 AS price_vnd, b.cancel_fee_vnd::float8 AS cancel_fee_vnd,
       (extract(epoch FROM b.start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM b.cancelled_at) * 1000)::float8 AS cancelled_ms
FROM public.bookings b
JOIN public.booking_services s ON s.id = b.service_id
WHERE b.workspace_id = $1 AND b.id = $2
LIMIT 1
FOR UPDATE OF b`

/** Takes a mark on a booking once: answers a row the first time and nothing after ($1 workspace, $2 booking, $3 mark). */
export const CLAIM_EFFECT = sql`UPDATE public.bookings
SET effects = effects || jsonb_build_object($3::text, true)
WHERE workspace_id = $1 AND id = $2 AND NOT (effects ? $3::text)
RETURNING id`

/** Gives a mark back, so a notice that did not reach the customer is tried again ($1 workspace, $2 booking, $3 mark). */
export const RELEASE_EFFECT = sql`UPDATE public.bookings
SET effects = effects - $3::text
WHERE workspace_id = $1 AND id = $2`

/** Records the fee of a cancellation or a no-show, once ($1 workspace, $2 booking, $3 fee in VND). */
export const SET_BOOKING_FEE = sql`UPDATE public.bookings
SET cancel_fee_vnd = $3
WHERE workspace_id = $1 AND id = $2 AND cancel_fee_vnd = 0
RETURNING id`

/** Hands a finished booking to the order chain as an inbound order, once per booking ($1 workspace, $2 origin, $3 customer, $4 contact, $5 body, $6 amount, $7 booking, $8 lead or null). */
export const INSERT_ORDER_HANDOFF = sql`INSERT INTO public.inbound_events (workspace_id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd, external_ref, dedupe_key, lead_id)
VALUES ($1, 'manual', 'order', $2, $3, $4, $5, $6, $7, 'booking:' || $7 || ':order', $8)
ON CONFLICT (workspace_id, dedupe_key) DO NOTHING
RETURNING id`
