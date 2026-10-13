import { sql } from "@modules/platform/database"

/** The bookings that start inside a window, optionally of one booking agent instance ($1 workspace, $2 from, $3 to, $4 instance or null). */
export const SELECT_WINDOW_BOOKINGS = sql`SELECT status, resource_id, party_size, price_vnd::float8 AS price_vnd,
       (extract(epoch FROM start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM end_at) * 1000)::float8 AS end_ms
FROM public.bookings
WHERE workspace_id = $1 AND start_at >= $2::timestamptz AND start_at < $3::timestamptz
  AND ($4::uuid IS NULL OR installation_id = $4::uuid)
LIMIT 5000`

/** The bookings that overlap a window, of every instance ($1 workspace, $2 from, $3 to). */
export const SELECT_OVERLAPPING_BOOKINGS = sql`SELECT status, resource_id, party_size, price_vnd::float8 AS price_vnd,
       (extract(epoch FROM start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM end_at) * 1000)::float8 AS end_ms
FROM public.bookings
WHERE workspace_id = $1 AND start_at < $3::timestamptz AND end_at > $2::timestamptz
LIMIT 5000`

/** How many bookings finished as done or as no-show in a window ($1 workspace, $2 from, $3 to, $4 instance or null). */
export const SELECT_FINISHED_COUNTS = sql`SELECT status, count(*)::int AS total
FROM public.bookings
WHERE workspace_id = $1 AND status IN ('done', 'no_show') AND start_at >= $2::timestamptz AND start_at < $3::timestamptz
  AND ($4::uuid IS NULL OR installation_id = $4::uuid)
GROUP BY status
LIMIT 2`

/** How many open bookings still owe a deposit, and how much ($1 workspace, $2 instance or null). */
export const SELECT_DEPOSITS_DUE = sql`SELECT count(*)::int AS total, COALESCE(sum(deposit_vnd), 0)::float8 AS amount_vnd
FROM public.bookings
WHERE workspace_id = $1 AND deposit_status = 'due' AND status IN ('requested', 'confirmed', 'rescheduled')
  AND ($2::uuid IS NULL OR installation_id = $2::uuid)`
