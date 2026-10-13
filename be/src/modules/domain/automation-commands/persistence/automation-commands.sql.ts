import { sql } from "@modules/platform/database"

/** The command a screen queued while it still waits ($1 command). */
export const SELECT_QUEUED_COMMAND = sql`SELECT id, workspace_id, kind, template_key, created_by FROM public.automation_commands
WHERE id = $1 AND status = 'queued' LIMIT 1`

/** Ends a command that waits with its answer or its fault code; a command already ended stays as it is ($1 command, $2 status, $3 result, $4 fault code, $5 finished at). */
export const SETTLE_COMMAND = sql`WITH changed AS (
    UPDATE public.automation_commands SET status = $2, result = $3::jsonb, fault_code = $4, finished_at = $5
    WHERE id = $1 AND status = 'queued' RETURNING id
) SELECT id FROM changed`
