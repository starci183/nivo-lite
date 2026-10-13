import { sql } from "@modules/platform/database"

/** One command by id. */
export const FIND_COMMAND = sql`SELECT id, workspace_id, user_id, kind, input, status FROM public.connection_commands WHERE id = $1 LIMIT 1`

/** Writes the outcome of a pending command and marks it done; a command that is already done is left as it is. */
export const FINISH_COMMAND = sql`UPDATE public.connection_commands SET status = 'done', outcome = $2::jsonb, finished_at = now() WHERE id = $1 AND status = 'pending' RETURNING id`
