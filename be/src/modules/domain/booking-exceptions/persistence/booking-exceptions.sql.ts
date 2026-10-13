import { sql } from "@modules/platform/database"

/** Adds a date exception ($1 workspace, $2 resource, $3 date, $4 closed, $5 start, $6 end, $7 note). */
export const INSERT_SETUP_EXCEPTION = sql`INSERT INTO public.booking_exceptions
    (workspace_id, resource_id, on_date, closed, start_time, end_time, note)
VALUES ($1, $2, $3::date, $4, $5::time, $6::time, $7) RETURNING id`

/** Removes an owned date exception ($1 workspace, $2 exception). */
export const DELETE_SETUP_EXCEPTION = sql`WITH changed AS (DELETE FROM public.booking_exceptions
WHERE workspace_id = $1 AND id = $2 RETURNING id) SELECT id FROM changed LIMIT 1`
