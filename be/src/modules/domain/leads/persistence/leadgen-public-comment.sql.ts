import { sql } from "@modules/platform/database"

/** Workspace-scoped fallback context for a captured prospect's comment. */
export const FIND_LEADGEN_PUBLIC_COMMENT_FLOW = sql`
    SELECT connection_id, conversation_id, platform FROM public.lead_flows
    WHERE workspace_id = $1 AND lead_id = $2 LIMIT 1`
