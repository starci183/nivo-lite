import { sql } from "@modules/platform/database"

/** The version of a lesson ($1 workspace, $2 id). */
export const SELECT_LESSON_VERSION = sql`SELECT version FROM public.brain_lessons WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Proposes a lesson ($1 workspace, $2 module, $3 title, $4 body, $5 applies when, $6 origin, $7 evidence, $8 version, $9 supersedes, $10 proposed by). */
export const INSERT_LESSON = sql`WITH changed AS (
    INSERT INTO public.brain_lessons (workspace_id, module, title, body, applies_when, status, origin, evidence, version, supersedes_id, proposed_by)
    VALUES ($1, $2, $3, $4, $5, 'proposed', $6, $7::jsonb, $8, $9, $10)
    RETURNING *
)
SELECT * FROM changed`

/** Approves or turns down a proposal ($1 workspace, $2 id, $3 new status, $4 decided by). */
export const DECIDE_LESSON = sql`WITH changed AS (
    UPDATE public.brain_lessons SET status = $3, decided_by = $4, decided_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'proposed' RETURNING *
)
SELECT * FROM changed`

/** Retires the lesson an approved new version replaces ($1 workspace, $2 id). */
export const RETIRE_SUPERSEDED = sql`WITH changed AS (
    UPDATE public.brain_lessons SET status = 'retired' WHERE workspace_id = $1 AND id = $2 AND status = 'active' RETURNING id
)
SELECT id FROM changed`

/** Retires an active lesson ($1 workspace, $2 id, $3 decided by). */
export const RETIRE_LESSON = sql`WITH changed AS (
    UPDATE public.brain_lessons SET status = 'retired', decided_by = $3, decided_at = now()
    WHERE workspace_id = $1 AND id = $2 AND status = 'active' RETURNING *
)
SELECT * FROM changed`

/** The lessons of a workspace with these statuses, newest first ($1 workspace, $2 statuses or null for all). */
export const SELECT_LESSONS = sql`SELECT * FROM public.brain_lessons
WHERE workspace_id = $1 AND ($2::text[] IS NULL OR status = ANY($2::text[])) ORDER BY proposed_at DESC LIMIT 500`
