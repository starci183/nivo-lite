import { sql } from "@modules/platform/database"

/** One loyalty command ($1 command). */
export const SELECT_COMMAND = sql`SELECT id, workspace_id, kind, params, status, created_by
FROM public.loyalty_commands
WHERE id = $1
LIMIT 1`

/** Settles a command that is still queued: the status, the answer, the error code and the params (emptied for a visitor, whose phone and code are not kept) ($1 command, $2 status, $3 result, $4 error code, $5 empty the params). */
export const FINISH_COMMAND = sql`UPDATE public.loyalty_commands
SET status = $2, result = $3::jsonb, error_code = $4, finished_at = now(),
    params = CASE WHEN $5::boolean THEN '{}'::jsonb ELSE params END
WHERE id = $1 AND status = 'queued'
RETURNING id`
