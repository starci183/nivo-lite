import { sql } from "@modules/platform/database"

/** Creates a service ($1 workspace, $2 name, $3 description, $4 duration, $5 buffer, $6 price, $7 kind, $8 followup days, $9 active). */
export const INSERT_SERVICE = sql`INSERT INTO public.booking_services
    (workspace_id, name, description, duration_min, buffer_min, price_vnd, resource_kind, followup_days, active)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id`

/** Changes an owned service (insert arguments $1-$9, $10 service). */
export const UPDATE_SERVICE = sql`WITH changed AS (UPDATE public.booking_services
SET name = $2, description = $3, duration_min = $4, buffer_min = $5, price_vnd = $6,
    resource_kind = $7, followup_days = $8, active = $9
WHERE workspace_id = $1 AND id = $10
RETURNING id) SELECT id FROM changed LIMIT 1`

/** Locks an owned service before removal ($1 workspace, $2 service). */
export const LOCK_SERVICE = sql`SELECT id FROM public.booking_services
WHERE workspace_id = $1 AND id = $2 LIMIT 1 FOR UPDATE`

/** Checks service booking and waitlist history ($1 workspace, $2 service). */
export const SELECT_SERVICE_USAGE = sql`SELECT EXISTS (
    SELECT id FROM public.bookings WHERE workspace_id = $1 AND service_id = $2 LIMIT 1
) OR EXISTS (
    SELECT id FROM public.booking_waitlist WHERE workspace_id = $1 AND service_id = $2 LIMIT 1
) AS value`

/** Retires a service while preserving its history ($1 workspace, $2 service). */
export const RETIRE_SERVICE = sql`WITH changed AS (UPDATE public.booking_services SET active = false
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`

/** Deletes an unused service ($1 workspace, $2 service). */
export const DELETE_SERVICE = sql`WITH changed AS (DELETE FROM public.booking_services
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`
