import { sql } from "@modules/platform/database"

/** Opens a sync run as running and answers it ($1 workspace, $2 connection, $3 trigger). */
export const INSERT_SYNC_RUN = sql`WITH created AS (
    INSERT INTO public.data_sync_runs (workspace_id, connection_id, trigger)
    VALUES ($1::uuid, $2::uuid, $3)
    RETURNING id, connection_id, trigger, status, rows_upserted, error, started_at, finished_at
)
SELECT id, connection_id, trigger, status, rows_upserted, error,
       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
       to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS finished_at
FROM created`

/** Settles a run that is still running ($1 run, $2 status, $3 rows, $4 error or null). */
export const FINISH_SYNC_RUN = sql`UPDATE public.data_sync_runs
SET status = $2, rows_upserted = $3, error = $4, finished_at = now()
WHERE id = $1::uuid AND status = 'running'`

/** One run of a workspace ($1 workspace, $2 run). */
export const FIND_SYNC_RUN = sql`SELECT id, connection_id, trigger, status, rows_upserted, error,
       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
       to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS finished_at
FROM public.data_sync_runs
WHERE workspace_id = $1::uuid AND id = $2::uuid
LIMIT 1`
