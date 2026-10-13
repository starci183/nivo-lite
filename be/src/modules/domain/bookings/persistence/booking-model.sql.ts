import { sql } from "@modules/platform/database"

/** The role of an active member of a workspace ($1 workspace, $2 user). */
export const SELECT_MEMBER_ROLE = sql`SELECT role
FROM public.workspace_members
WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'
LIMIT 1`

/** The booking settings of one workspace ($1 workspace). */
export const SELECT_SETTINGS = sql`SELECT timezone, slot_step_min, min_lead_min, max_advance_days, cancel_window_hours, deposit_pct,
       late_cancel_fee_pct, no_show_fee_vnd::float8 AS no_show_fee_vnd, auto_confirm, handoff_order, reminder_hours,
       public_enabled, public_slug, public_note, address
FROM public.booking_settings
WHERE workspace_id = $1
LIMIT 1`

/** The published page that owns a slug, with the shop name ($1 slug). */
export const SELECT_PAGE_BY_SLUG = sql`SELECT s.workspace_id, s.public_note, s.address, s.timezone, w.name AS shop
FROM public.booking_settings s
JOIN public.workspaces w ON w.id = s.workspace_id
WHERE s.public_slug = $1 AND s.public_enabled
LIMIT 1`

/** The services of a workspace in display order ($1 workspace). */
export const SELECT_SERVICES = sql`SELECT id, name, description, duration_min, buffer_min, price_vnd::float8 AS price_vnd, resource_kind, followup_days, active
FROM public.booking_services
WHERE workspace_id = $1
ORDER BY sort_order, created_at
LIMIT 200`

/** The resources of a workspace in display order ($1 workspace). */
export const SELECT_RESOURCES = sql`SELECT id, name, kind, capacity, active, sort_order
FROM public.booking_resources
WHERE workspace_id = $1
ORDER BY sort_order, created_at
LIMIT 200`

/** The weekly hours of every resource of a workspace ($1 workspace). */
export const SELECT_HOURS = sql`SELECT resource_id, weekday, start_time::text AS start_time, end_time::text AS end_time
FROM public.booking_hours
WHERE workspace_id = $1
LIMIT 2000`

/** The date exceptions of a workspace ($1 workspace). */
export const SELECT_EXCEPTIONS = sql`SELECT resource_id, on_date::text AS on_date, closed, start_time::text AS start_time, end_time::text AS end_time
FROM public.booking_exceptions
WHERE workspace_id = $1
LIMIT 1000`

/** The bookings that hold a resource between two instants ($1 workspace, $2 from, $3 to). */
export const SELECT_HELD_SPANS = sql`SELECT id, resource_id, party_size,
       (extract(epoch FROM start_at) * 1000)::float8 AS start_ms,
       (extract(epoch FROM block_end_at) * 1000)::float8 AS block_end_ms
FROM public.bookings
WHERE workspace_id = $1 AND holds_slot AND status IN ('requested', 'confirmed', 'rescheduled')
  AND start_at < $3::timestamptz AND block_end_at > $2::timestamptz
LIMIT 5000`

/** The approved leave days of staff linked to a resource, as whole-day blocks ($1 workspace, $2 from, $3 to). */
export const SELECT_LEAVE_DAYS = sql`SELECT r.id AS resource_id, l.staff_id AS leave_staff, l.from_date::text AS from_date, l.to_date::text AS to_date
FROM public.booking_resources r
JOIN public.shifts_staff p ON p.staff_id = r.staff_id AND p.workspace_id = r.workspace_id
JOIN public.shifts_leave_requests l ON l.staff_id = p.id AND l.workspace_id = r.workspace_id
WHERE r.workspace_id = $1 AND l.status = 'approved'
  AND l.from_date <= $3::date AND l.to_date >= $2::date
LIMIT 500`
