import { sql } from "@modules/platform/database"

/** The newest time any sync of the workspace ran ($1 workspace). */
export const FIND_LAST_SYNC_CHECK = sql`SELECT max(checked_at) AS checked_at FROM public.openclaw_agent_sync WHERE workspace_id = $1`
