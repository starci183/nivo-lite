import { sql } from "@modules/platform/database"

/** The grants of one agent of a workspace ($1 workspace, $2 agent). */
export const LIST_AGENT_GRANTS = sql`
    SELECT tool, mode, limit_vnd, constraints
    FROM public.mcp_tool_grants
    WHERE workspace_id = $1 AND agent_id = $2
    ORDER BY tool
    LIMIT 500`

/** Every grant of a workspace with the agent's name ($1 workspace). */
export const LIST_WORKSPACE_GRANTS = sql`
    SELECT g.agent_id, a.name AS agent_name, g.tool, g.mode, g.limit_vnd, g.constraints
    FROM public.mcp_tool_grants g
    JOIN public.agents a ON a.id = g.agent_id
    WHERE g.workspace_id = $1
    ORDER BY a.name, g.tool
    LIMIT 500`

/** The agents of a workspace holding any of the tools in a mode other than never, oldest grant first ($1 workspace, $2 tools). */
export const AGENTS_GRANTED = sql`
    SELECT g.agent_id
    FROM public.mcp_tool_grants g
    WHERE g.workspace_id = $1 AND g.tool = ANY($2::text[]) AND g.mode <> 'never'
    ORDER BY g.updated_at
    LIMIT 500`

/** Sets one grant of an agent of the workspace; answers no row when the agent is not the workspace's ($1 workspace to $7 person). */
export const UPSERT_GRANT = sql`
    INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode, limit_vnd, constraints, updated_by)
    SELECT $1, a.id, $3, $4, $5, $6::jsonb, $7
    FROM public.agents a
    WHERE a.id = $2 AND a.workspace_id = $1
    ON CONFLICT (agent_id, tool) DO UPDATE
    SET mode = EXCLUDED.mode, limit_vnd = EXCLUDED.limit_vnd, constraints = EXCLUDED.constraints,
        updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING id`

/**
 * Sets many grants in one statement ($1 a JSON array of { workspace_id, agent_id, tool, mode, limit_vnd, constraints }); a row
 * whose agent is not of its workspace is skipped. Answers the grants written.
 */
export const UPSERT_GRANTS = sql`
    INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode, limit_vnd, constraints, updated_by)
    SELECT a.workspace_id, a.id, r.tool, r.mode, r.limit_vnd, coalesce(r.constraints, '[]'::jsonb), NULL
    FROM jsonb_to_recordset($1::jsonb)
        AS r(workspace_id uuid, agent_id uuid, tool text, mode text, limit_vnd bigint, constraints jsonb)
    JOIN public.agents a ON a.id = r.agent_id AND a.workspace_id = r.workspace_id
    ON CONFLICT (agent_id, tool) DO UPDATE
    SET mode = EXCLUDED.mode, limit_vnd = EXCLUDED.limit_vnd, constraints = EXCLUDED.constraints,
        updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING id`
