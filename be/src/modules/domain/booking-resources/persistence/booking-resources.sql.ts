import { sql } from "@modules/platform/database"

/** Creates a resource ($1 workspace, $2 name, $3 kind, $4 capacity, $5 active, $6 staff). */
export const INSERT_RESOURCE = sql`INSERT INTO public.booking_resources
    (workspace_id, name, kind, capacity, active, staff_id)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`

/** Changes an owned resource (insert arguments $1-$6, $7 resource). */
export const UPDATE_RESOURCE = sql`WITH changed AS (UPDATE public.booking_resources
SET name = $2, kind = $3, capacity = $4, active = $5, staff_id = $6
WHERE workspace_id = $1 AND id = $7 RETURNING id) SELECT id FROM changed LIMIT 1`

/** Locks an owned resource before changing its calendar or removing it ($1 workspace, $2 resource). */
export const LOCK_RESOURCE = sql`SELECT id FROM public.booking_resources
WHERE workspace_id = $1 AND id = $2 LIMIT 1 FOR UPDATE`

/** Locks the linked staff row within its workspace until the resource write finishes ($1 workspace, $2 staff). */
export const LOCK_STAFF = sql`SELECT id FROM public.staff
WHERE workspace_id = $1 AND id = $2 LIMIT 1 FOR SHARE`

/** Checks resource booking and waitlist history ($1 workspace, $2 resource). */
export const SELECT_RESOURCE_USAGE = sql`SELECT EXISTS (
    SELECT id FROM public.bookings WHERE workspace_id = $1 AND resource_id = $2 LIMIT 1
) OR EXISTS (
    SELECT id FROM public.booking_waitlist WHERE workspace_id = $1 AND resource_id = $2 LIMIT 1
) AS value`

/** Retires a resource while preserving its history ($1 workspace, $2 resource). */
export const RETIRE_RESOURCE = sql`WITH changed AS (UPDATE public.booking_resources SET active = false
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`

/** Deletes an unused resource ($1 workspace, $2 resource). */
export const DELETE_RESOURCE = sql`WITH changed AS (DELETE FROM public.booking_resources
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`
