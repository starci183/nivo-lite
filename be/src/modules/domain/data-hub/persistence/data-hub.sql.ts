import { sql } from "@modules/platform/database"

/** Upserts hub rows of one entity in one statement; a repeated external id updates its row ($1 workspace, $2 connection, $3 entity, $4 rows as json). */
export const UPSERT_DATA_RECORDS = sql`INSERT INTO public.data_records (workspace_id, connection_id, entity, external_id, title, occurred_at, data, synced_at)
SELECT $1::uuid, $2::uuid, $3, r.external_id, r.title, r.occurred_at, r.data, now()
FROM jsonb_to_recordset($4::jsonb) AS r(external_id text, title text, occurred_at timestamptz, data jsonb)
ON CONFLICT (connection_id, entity, external_id) DO UPDATE
SET title = excluded.title, occurred_at = excluded.occurred_at, data = excluded.data, synced_at = excluded.synced_at`

/** How many of the given external ids a connection already holds for an entity ($1 connection, $2 entity, $3 ids). */
export const COUNT_EXISTING_DATA_RECORDS = sql`SELECT count(*)::int AS n
FROM public.data_records
WHERE connection_id = $1::uuid AND entity = $2 AND external_id = ANY($3::text[])`

/** How many hub rows a connection holds in all ($1 connection). */
export const COUNT_DATA_RECORDS = sql`SELECT count(*)::int AS n
FROM public.data_records
WHERE connection_id = $1::uuid`

/** Opens a sync run as running ($1 workspace, $2 connection, $3 trigger). */
export const INSERT_SYNC_RUN = sql`INSERT INTO public.data_sync_runs (workspace_id, connection_id, trigger)
VALUES ($1::uuid, $2::uuid, $3)
RETURNING id`

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

/** The latest run of a connection ($1 workspace, $2 connection). */
export const FIND_LATEST_SYNC_RUN = sql`SELECT id, connection_id, trigger, status, rows_upserted, error,
       to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS started_at,
       to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS finished_at
FROM public.data_sync_runs
WHERE workspace_id = $1::uuid AND connection_id = $2::uuid
ORDER BY started_at DESC
LIMIT 1`
