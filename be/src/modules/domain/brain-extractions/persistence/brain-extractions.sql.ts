import { sql } from "@modules/platform/database"

/** The reading of a document ($1 workspace, $2 source). */
export const SELECT_EXTRACTION = sql`SELECT source_id, workspace_id, status, facts_proposed, prompt_version, content_hash, windows_total, windows_done, attempts, orphan_fact_ids
FROM public.brain_extractions WHERE workspace_id = $1 AND source_id = $2 LIMIT 1`

/** Starts (or restarts) the reading of a document ($1 workspace, $2 source, $3 prompt version, $4 hash, $5 windows, $6 orphans). */
export const UPSERT_EXTRACTION = sql`WITH changed AS (
    INSERT INTO public.brain_extractions (source_id, workspace_id, status, facts_proposed, error, model, prompt_version, content_hash, windows_total, windows_done, attempts, orphan_fact_ids)
    VALUES ($2, $1, 'running', 0, NULL, NULL, $3, $4, $5, 0, 0, $6::uuid[])
    ON CONFLICT (source_id) DO UPDATE SET
        status = 'running', facts_proposed = 0, error = NULL, model = NULL, prompt_version = excluded.prompt_version, content_hash = excluded.content_hash,
        windows_total = excluded.windows_total, windows_done = 0, attempts = 0, orphan_fact_ids = excluded.orphan_fact_ids, updated_at = now()
    RETURNING source_id
)
SELECT source_id FROM changed`

/** Saves how far a reading got ($1 workspace, $2 source, $3 status, $4 windows done, $5 facts filed, $6 windows, $7 error, $8 attempts). */
export const SAVE_PROGRESS = sql`WITH changed AS (
    UPDATE public.brain_extractions SET status = $3, windows_done = $4, facts_proposed = $5, windows_total = $6, error = $7, attempts = $8, updated_at = now()
    WHERE workspace_id = $1 AND source_id = $2 RETURNING source_id
)
SELECT source_id FROM changed`

/** Closes a reading as done ($1 workspace, $2 source, $3 model). */
export const FINISH_EXTRACTION = sql`WITH changed AS (
    UPDATE public.brain_extractions SET status = 'done', error = NULL, model = $3, orphan_fact_ids = '{}', updated_at = now()
    WHERE workspace_id = $1 AND source_id = $2 RETURNING source_id
)
SELECT source_id FROM changed`

/** Settles a reading that is not done as failed ($1 workspace, $2 source, $3 note). */
export const FAIL_EXTRACTION = sql`WITH changed AS (
    UPDATE public.brain_extractions SET status = 'failed', error = $3, updated_at = now()
    WHERE workspace_id = $1 AND source_id = $2 AND status <> 'done' RETURNING source_id
)
SELECT source_id FROM changed`

/** Where the reading of each document of a workspace stands ($1 workspace). */
export const LIST_EXTRACTIONS = sql`SELECT source_id, status FROM public.brain_extractions WHERE workspace_id = $1 LIMIT 500`
