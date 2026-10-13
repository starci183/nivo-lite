import { sql } from "@modules/platform/database"

/** The full resource setup catalog ($1 workspace). */
export const SELECT_BOARD_RESOURCES = sql`SELECT id, name, kind, capacity, color, active, staff_id, sort_order
FROM public.booking_resources
WHERE workspace_id = $1
ORDER BY sort_order, created_at
LIMIT 200`

/** Editable exceptions from the selected range or yesterday onwards ($1 workspace, $2 first date). */
export const SELECT_BOARD_EXCEPTIONS = sql`SELECT id, resource_id, on_date::text AS on_date, closed,
       start_time::text AS start_time, end_time::text AS end_time, note
FROM public.booking_exceptions
WHERE workspace_id = $1 AND on_date >= $2::date
ORDER BY on_date, id
LIMIT 1000`

/** Complete appointments overlapping a local-date window ($1 workspace, $2 from instant, $3 exclusive end). */
export const SELECT_BOARD_BOOKINGS = sql`SELECT b.id, b.customer_name, b.customer_phone, b.service_id,
       COALESCE(s.name, '') AS service_name, b.resource_id,
       (extract(epoch FROM b.start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM b.end_at) * 1000)::float8 AS end_ms,
       b.status, b.holds_slot, b.party_size, b.price_vnd::float8 AS price_vnd,
       b.deposit_vnd::float8 AS deposit_vnd, b.deposit_status, b.cancel_fee_vnd::float8 AS cancel_fee_vnd,
       (b.checked_in_at IS NOT NULL) AS checked_in, b.note, b.conflict_note,
       b.source_channel, b.lead_id, b.reschedule_count
FROM public.bookings b
LEFT JOIN public.booking_services s ON s.id = b.service_id AND s.workspace_id = b.workspace_id
WHERE b.workspace_id = $1 AND b.start_at < $3::timestamptz AND b.end_at > $2::timestamptz
ORDER BY b.start_at, b.id
LIMIT 2000`

/** Waiting customers and the current service name ($1 workspace). */
export const SELECT_BOARD_WAITLIST = sql`SELECT w.id, w.customer_name, w.customer_phone,
       COALESCE(s.name, '') AS service_name,
       (extract(epoch FROM w.window_start) * 1000)::float8 AS from_ms,
       (extract(epoch FROM w.window_end) * 1000)::float8 AS to_ms,
       w.party_size, w.status
FROM public.booking_waitlist w
LEFT JOIN public.booking_services s ON s.id = w.service_id AND s.workspace_id = w.workspace_id
WHERE w.workspace_id = $1 AND w.status IN ('waiting', 'notified')
ORDER BY w.created_at DESC, w.id
LIMIT 100`

/** Active staff that resources can be linked to ($1 workspace). */
export const SELECT_BOARD_STAFF = sql`SELECT id, name
FROM public.staff
WHERE workspace_id = $1 AND active
ORDER BY name, id
LIMIT 200`
