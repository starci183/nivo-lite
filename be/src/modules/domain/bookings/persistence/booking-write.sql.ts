import { sql } from "@modules/platform/database"

/** Locks one resource of a workspace for the rest of the transaction and answers its capacity ($1 resource, $2 workspace). */
export const LOCK_RESOURCE = sql`SELECT capacity
FROM public.booking_resources
WHERE id = $1 AND workspace_id = $2
LIMIT 1
FOR UPDATE`

/** The bookings that hold one resource between two instants, optionally leaving one out ($1 resource, $2 from, $3 to, $4 excluded booking or null). */
export const SELECT_RESOURCE_SPANS = sql`SELECT id, resource_id, party_size,
       (extract(epoch FROM start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM block_end_at) * 1000)::float8 AS block_end_ms
FROM public.bookings
WHERE resource_id = $1 AND holds_slot AND status IN ('requested', 'confirmed', 'rescheduled')
  AND start_at < $3::timestamptz AND block_end_at > $2::timestamptz
  AND ($4::uuid IS NULL OR id <> $4::uuid)
LIMIT 5000`

/** Writes one booking and answers its id ($1 workspace, $2 customer name, $3 phone, $4 email, $5 service, $6 resource, $7 start, $8 end, $9 block end,
 * $10 party, $11 status, $12 holds the slot, $13 source channel, $14 price, $15 deposit, $16 deposit status, $17 note, $18 conflict note, $19 idempotency key). */
export const INSERT_BOOKING = sql`INSERT INTO public.bookings (workspace_id, customer_name, customer_phone, customer_email, service_id, resource_id,
  start_at, end_at, block_end_at, party_size, status, holds_slot, source_channel, price_vnd, deposit_vnd, deposit_status, note, conflict_note, idempotency_key)
VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, $9::timestamptz, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
RETURNING id`

/** The booking an idempotency key already created ($1 workspace, $2 key). */
export const SELECT_BOOKING_BY_KEY = sql`SELECT id, status, holds_slot
FROM public.bookings
WHERE workspace_id = $1 AND idempotency_key = $2
LIMIT 1`

/** One booking of a workspace with the timing of its service, locked for the rest of the transaction ($1 workspace, $2 booking). */
export const SELECT_BOOKING_FOR_UPDATE = sql`SELECT b.id, b.resource_id, b.party_size, b.status, s.duration_min, s.buffer_min,
       (extract(epoch FROM b.start_at) * 1000)::float8 AS start_ms
FROM public.bookings b
JOIN public.booking_services s ON s.id = b.service_id
WHERE b.workspace_id = $1 AND b.id = $2
LIMIT 1
FOR UPDATE OF b`

/** Moves a booking to another time or resource and counts the change ($1 workspace, $2 booking, $3 resource, $4 start, $5 end, $6 block end, $7 now). */
export const RELOCATE_BOOKING = sql`UPDATE public.bookings
SET resource_id = $3, start_at = $4::timestamptz, end_at = $5::timestamptz, block_end_at = $6::timestamptz, holds_slot = true,
    rescheduled_from = CASE WHEN $4::timestamptz <> start_at THEN start_at ELSE rescheduled_from END,
    reschedule_count = reschedule_count + CASE WHEN $4::timestamptz <> start_at THEN 1 ELSE 0 END,
    status = CASE WHEN $4::timestamptz <> start_at AND status IN ('confirmed', 'rescheduled') THEN 'rescheduled' ELSE status END,
    conflict_note = '', updated_at = $7::timestamptz
WHERE workspace_id = $1 AND id = $2`

/** Confirms a booking and makes it hold its slot ($1 workspace, $2 booking, $3 now). */
export const CONFIRM_BOOKING = sql`UPDATE public.bookings
SET status = 'confirmed', holds_slot = true, conflict_note = '', updated_at = $3::timestamptz
WHERE workspace_id = $1 AND id = $2`

/** Records the arrival of the customer ($1 workspace, $2 booking, $3 now). */
export const CHECK_IN_BOOKING = sql`UPDATE public.bookings
SET checked_in_at = $3::timestamptz, status = 'confirmed', updated_at = $3::timestamptz
WHERE workspace_id = $1 AND id = $2`

/** Finishes a booking; the arrival time is kept when it exists ($1 workspace, $2 booking, $3 now). */
export const FINISH_BOOKING = sql`UPDATE public.bookings
SET status = 'done', done_at = $3::timestamptz, checked_in_at = COALESCE(checked_in_at, $3::timestamptz), updated_at = $3::timestamptz
WHERE workspace_id = $1 AND id = $2`

/** Records that the customer did not come ($1 workspace, $2 booking, $3 now). */
export const MARK_NO_SHOW = sql`UPDATE public.bookings
SET status = 'no_show', updated_at = $3::timestamptz
WHERE workspace_id = $1 AND id = $2`

/** Cancels a booking and frees its slot ($1 workspace, $2 booking, $3 now, $4 reason). */
export const CANCEL_BOOKING = sql`UPDATE public.bookings
SET status = 'cancelled', holds_slot = false, cancelled_at = $3::timestamptz, cancel_reason = $4, updated_at = $3::timestamptz
WHERE workspace_id = $1 AND id = $2`
