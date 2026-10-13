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
