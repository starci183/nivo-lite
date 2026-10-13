import { sql } from "@modules/platform/database"

/** Opens a new resource Monday to Saturday ($1 workspace, $2 resource). */
export const INSERT_SETUP_DEFAULT_HOURS = sql`INSERT INTO public.booking_hours
    (workspace_id, resource_id, weekday, start_time, end_time)
VALUES ($1, $2, 1, '09:00', '18:00'), ($1, $2, 2, '09:00', '18:00'),
       ($1, $2, 3, '09:00', '18:00'), ($1, $2, 4, '09:00', '18:00'),
       ($1, $2, 5, '09:00', '18:00'), ($1, $2, 6, '09:00', '18:00')`

/** Removes old windows in their replacement transaction ($1 workspace, $2 resource). */
export const DELETE_SETUP_HOURS = sql`WITH changed AS (DELETE FROM public.booking_hours
WHERE workspace_id = $1 AND resource_id = $2 RETURNING id)
SELECT id FROM changed LIMIT 56`

/** Inserts bounded windows ($1 workspace, $2 resource, $3 weekdays, $4 opening times, $5 closing times). */
export const INSERT_SETUP_HOURS = sql`INSERT INTO public.booking_hours
    (workspace_id, resource_id, weekday, start_time, end_time)
SELECT $1, $2, hours.weekday, hours.start_time::time, hours.end_time::time
FROM unnest($3::smallint[], $4::text[], $5::text[]) AS hours(weekday, start_time, end_time)
LIMIT 56`
