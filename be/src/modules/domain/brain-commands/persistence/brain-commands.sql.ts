import { sql } from "@modules/platform/database"

/** One command of a workspace ($1 workspace, $2 id). */
export const SELECT_COMMAND = sql`SELECT id, workspace_id, requested_by, kind, payload, status
FROM public.brain_commands WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Takes a queued command (or one a worker dropped while running) ($1 workspace, $2 id). */
export const BEGIN_COMMAND = sql`WITH changed AS (
    UPDATE public.brain_commands SET status = 'running'
    WHERE workspace_id = $1 AND id = $2 AND status IN ('queued', 'running') RETURNING id
)
SELECT id FROM changed`

/** Closes a command as done and drops the token a Drive command carried ($1 workspace, $2 id, $3 result as json). */
export const FINISH_COMMAND = sql`WITH changed AS (
    UPDATE public.brain_commands SET status = 'done', result = $3::jsonb, error_code = NULL, payload = payload - 'token', finished_at = now()
    WHERE workspace_id = $1 AND id = $2 RETURNING id
)
SELECT id FROM changed`

/** Closes a command as failed with a stored code and drops the token a Drive command carried ($1 workspace, $2 id, $3 code). */
export const FAIL_COMMAND = sql`WITH changed AS (
    UPDATE public.brain_commands SET status = 'failed', result = NULL, error_code = $3, payload = payload - 'token', finished_at = now()
    WHERE workspace_id = $1 AND id = $2 RETURNING id
)
SELECT id FROM changed`

/** Writes a queued command and answers its id ($1 workspace, $2 requester, $3 kind, $4 payload as json). */
export const INSERT_COMMAND = sql`WITH changed AS (
    INSERT INTO public.brain_commands (workspace_id, requested_by, kind, payload) VALUES ($1, $2, $3, $4::jsonb) RETURNING id
)
SELECT id FROM changed`

/** How a command stands for the person who asked ($1 workspace, $2 id, $3 requester). */
export const SELECT_COMMAND_STATE = sql`SELECT status, result, error_code FROM public.brain_commands
WHERE workspace_id = $1 AND id = $2 AND requested_by = $3 LIMIT 1`
