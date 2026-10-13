import { sql } from "@modules/platform/database"

/** Writes one queued source and answers its id ($1 workspace, $2 module, $3 installation, $4 kind, $5 topic, $6 tags, $7 visibility, $8 title, $9 content, $10 storage path, $11 source url, $12 origin, $13 creator). */
export const INSERT_SOURCE = sql`WITH changed AS (
    INSERT INTO public.knowledge_sources
        (workspace_id, module, installation_id, kind, topic, tags, visibility, title, content, status, progress, storage_path, source_url, origin, created_by)
    VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8, $9, 'queued', 0, $10, $11, $12, $13)
    RETURNING id
)
SELECT id FROM changed`

/** One source of a workspace ($1 id, $2 workspace). */
export const SELECT_SOURCE = sql`SELECT id, workspace_id, module, installation_id, kind, topic, tags, visibility, title, content, status, error,
    chunk_count, progress, storage_path, source_url, origin, created_by, created_at, updated_at
FROM public.knowledge_sources WHERE id = $1 AND workspace_id = $2 LIMIT 1`

/** Puts a failed or credit-blocked source back on the queue; no row when the source is not in such a state ($1 id, $2 workspace). */
export const REQUEUE_FAILED_SOURCE = sql`WITH changed AS (
    UPDATE public.knowledge_sources
    SET status = 'queued', progress = 0, error = NULL, updated_at = now()
    WHERE id = $1 AND workspace_id = $2 AND status IN ('failed', 'blocked_credits')
    RETURNING id
)
SELECT id FROM changed`

/** Puts a source back on the queue after its text changed ($1 id, $2 workspace, $3 new content or null to keep it). */
export const REQUEUE_SOURCE = sql`WITH changed AS (
    UPDATE public.knowledge_sources
    SET status = 'queued', progress = 0, error = NULL, content = coalesce($3, content), updated_at = now()
    WHERE id = $1 AND workspace_id = $2
    RETURNING id
)
SELECT id FROM changed`

/** Changes the metadata of a source; the passages follow through the database trigger ($1 id, $2 workspace, $3 title, $4 topic, $5 tags, $6 module, $7 visibility; null keeps a value, '' clears topic and module). */
export const UPDATE_SOURCE_META = sql`WITH changed AS (
    UPDATE public.knowledge_sources SET
        title = coalesce($3, title),
        topic = CASE WHEN $4::text IS NULL THEN topic ELSE nullif($4, '') END,
        tags = coalesce($5::text[], tags),
        module = CASE WHEN $6::text IS NULL THEN module ELSE nullif($6, '') END,
        visibility = coalesce($7, visibility),
        updated_at = now()
    WHERE id = $1 AND workspace_id = $2
    RETURNING id
)
SELECT id FROM changed`

/** Deletes a source and answers its title; its passages go with it ($1 id, $2 workspace). */
export const DELETE_SOURCE = sql`WITH changed AS (
    DELETE FROM public.knowledge_sources WHERE id = $1 AND workspace_id = $2 RETURNING title
)
SELECT title FROM changed`

/** The agent instance a document may be kept for and the module of its type ($1 workspace, $2 installation). */
export const SELECT_INSTALLATION = sql`SELECT id, module_key FROM public.module_installations WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** A fresh random id, for the folder of an uploaded file. */
export const SELECT_NEW_ID = sql`SELECT gen_random_uuid() AS id`

/** The reading stage: the source is being read ($1 id, $2 workspace). */
export const MARK_READING = sql`UPDATE public.knowledge_sources SET status = 'reading', error = NULL, progress = 5, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** The indexing stage: the text is known ($1 id, $2 workspace, $3 content, $4 title). */
export const MARK_INDEXING = sql`UPDATE public.knowledge_sources SET status = 'indexing', content = $3, title = $4, progress = 20, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** Moves the progress bar ($1 id, $2 workspace, $3 percent). */
export const SET_PROGRESS = sql`UPDATE public.knowledge_sources SET progress = $3, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** Closes a source as failed with a stored code ($1 id, $2 workspace, $3 code). */
export const MARK_FAILED = sql`UPDATE public.knowledge_sources SET status = 'failed', error = $3, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** Closes a source as blocked by credits with the passages stored ($1 id, $2 workspace, $3 code, $4 chunk count). */
export const MARK_BLOCKED = sql`UPDATE public.knowledge_sources SET status = 'blocked_credits', error = $3, chunk_count = $4, progress = 80, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** Records the passages stored and a note, status unchanged ($1 id, $2 workspace, $3 note or null, $4 chunk count). */
export const MARK_INDEXED = sql`UPDATE public.knowledge_sources SET error = $3, chunk_count = $4, progress = 80, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** The facts stage: the passages are stored and the facts are being read ($1 id, $2 workspace). */
export const MARK_EXTRACTING = sql`UPDATE public.knowledge_sources SET status = 'extracting_facts', progress = 85, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** Done: the source is ready, with a stored note when the fact reading failed ($1 id, $2 workspace, $3 note or null). */
export const MARK_READY = sql`UPDATE public.knowledge_sources SET status = 'ready', progress = 100, error = coalesce($3, error), updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** The facts stage cannot run because the workspace has no credits left ($1 id, $2 workspace, $3 code). */
export const MARK_FACTS_BLOCKED = sql`UPDATE public.knowledge_sources SET status = 'blocked_credits', error = $3, updated_at = now() WHERE id = $1 AND workspace_id = $2`

/** The documents of a workspace for the Knowledge page, newest first and without their text ($1 workspace, $2 module or null for all). */
export const LIST_SOURCES = sql`SELECT id, workspace_id, module, installation_id, kind, topic, tags, visibility, title, status, error, chunk_count, progress, created_at, updated_at
FROM public.knowledge_sources WHERE workspace_id = $1 AND ($2::text IS NULL OR module = $2)
ORDER BY created_at DESC LIMIT 500`

/** One document of a workspace with its text ($1 workspace, $2 id). */
export const SELECT_SOURCE_DETAIL = sql`SELECT id, workspace_id, module, installation_id, kind, topic, tags, visibility, title, status, error, chunk_count, progress, created_at, updated_at, content
FROM public.knowledge_sources WHERE workspace_id = $1 AND id = $2 LIMIT 1`
