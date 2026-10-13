import { sql } from "@modules/platform/database"

/** Takes a command that is queued or already running and marks it running; a finished command answers nothing ($1 command). */
export const BEGIN_COMMAND = sql`WITH changed AS (
    UPDATE public.app_commands SET state = 'running'
    WHERE id = $1 AND state IN ('queued', 'running')
    RETURNING id, workspace_id, requested_by, kind, input
)
SELECT id, workspace_id, requested_by, kind, input FROM changed`

/** Settles a command as done with its result ($1 command, $2 result as JSON text). */
export const SUCCEED_COMMAND = sql`WITH changed AS (
    UPDATE public.app_commands
    SET state = 'done', result = $2::jsonb, error_code = NULL, finished_at = now()
    WHERE id = $1 AND state IN ('queued', 'running')
    RETURNING id
)
SELECT id FROM changed`

/** Settles a command as failed with the code the web app shows ($1 command, $2 code). */
export const FAIL_COMMAND = sql`WITH changed AS (
    UPDATE public.app_commands
    SET state = 'failed', error_code = left($2, 80), finished_at = now()
    WHERE id = $1 AND state IN ('queued', 'running')
    RETURNING id
)
SELECT id FROM changed`
