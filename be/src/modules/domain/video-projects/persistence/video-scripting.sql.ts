import { sql } from "@modules/platform/database"

/** Marks a project atomically with its queued generation ($1 workspace, $2 project, $3 metadata). */
export const START_SCRIPT_PROJECT = sql`UPDATE public.video_projects
SET status = 'scripting', last_error = NULL, script_meta = $3::jsonb
WHERE workspace_id = $1 AND id = $2`

/** Applies one generated script and invalidates approval of the previous content ($1 workspace, $2 project, $3 generation, $4 scenes, $5 duration, $6 title, $7 metadata). */
export const FINISH_SCRIPT_PROJECT = sql`UPDATE public.video_projects
SET status = 'draft', script = $4::jsonb, script_ms = $5, title = coalesce($6, title),
last_error = NULL, script_meta = $7::jsonb, approved_at = NULL, approved_by_name = NULL, published_at = NULL
WHERE workspace_id = $1 AND id = $2 AND status = 'scripting' AND script_meta->>'generation_id' = $3`

/** Fails the operation that still owns the project ($1 workspace, $2 project, $3 generation, $4 code, $5 metadata). */
export const FAIL_SCRIPT_PROJECT = sql`UPDATE public.video_projects
SET status = 'draft', last_error = $4, script_meta = $5::jsonb
WHERE workspace_id = $1 AND id = $2 AND status = 'scripting' AND script_meta->>'generation_id' = $3`
