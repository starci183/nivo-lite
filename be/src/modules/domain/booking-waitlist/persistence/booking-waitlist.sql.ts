import { sql } from "@modules/platform/database"

/** Cancels an owned waitlist entry while preserving its history ($1 workspace, $2 entry). */
export const CANCEL_SETUP_WAITLIST = sql`WITH changed AS (UPDATE public.booking_waitlist SET status = 'cancelled'
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`

/**
 * Puts a customer on the waiting line of a service for a window, once per chat, service and window: asking again changes nothing
 * ($1 workspace, $2 lead or null, $3 conversation or null, $4 name, $5 phone or null, $6 service, $7 window start, $8 window end, $9 party, $10 note).
 */
export const JOIN_WAITLIST = sql`INSERT INTO public.booking_waitlist
    (workspace_id, lead_id, conversation_id, customer_name, customer_phone, service_id, window_start, window_end, party_size, note)
SELECT $1, $2::uuid, $3::uuid, $4, $5, $6::uuid, $7::timestamptz, $8::timestamptz, $9, $10
WHERE NOT EXISTS (
    SELECT 1 FROM public.booking_waitlist w
    WHERE w.workspace_id = $1 AND w.service_id = $6::uuid AND w.status = 'waiting'
      AND w.window_start = $7::timestamptz AND w.window_end = $8::timestamptz
      AND (w.conversation_id = $3::uuid OR (w.lead_id IS NOT NULL AND w.lead_id = $2::uuid))
)
RETURNING id`
