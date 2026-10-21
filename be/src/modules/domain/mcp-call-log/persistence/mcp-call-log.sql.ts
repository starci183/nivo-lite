import { sql } from "@modules/platform/database"

/** Appends one audit line ($1 workspace to $13 approver). */
export const INSERT_CALL_LOG = sql`
    INSERT INTO public.mcp_call_log (workspace_id, connector, tool, agent_id, conversation_id, work_item_id, args_masked,
        args_hash, outcome, error_code, result_summary, duration_ms, approved_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)`

/** The newest audit lines of a workspace with the agent's name ($1 workspace, $2 how many). */
export const LIST_CALL_LOG = sql`
    SELECT l.id, l.tool, coalesce(a.name, '') AS agent_name, l.outcome, l.error_code, l.args_masked::text AS args_masked,
           l.result_summary, l.duration_ms, l.approved_by, l.created_at
    FROM public.mcp_call_log l
    LEFT JOIN public.agents a ON a.id = l.agent_id
    WHERE l.workspace_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2`
