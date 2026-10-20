import { sql } from "@modules/platform/database"

/** The connector rows of a workspace (native rows only toggle status). */
export const LIST_CONNECTORS = sql`
    SELECT key, name, kind, url, credential_ref, status, contract_version, timeout_ms, tool_catalog
    FROM public.mcp_connectors
    WHERE workspace_id = $1
    ORDER BY key`

/** Registers or updates a remote connector; the catalog is kept until the next sync. */
export const UPSERT_REMOTE_CONNECTOR = sql`
    INSERT INTO public.mcp_connectors (workspace_id, key, name, kind, url, credential_ref, contract_version, timeout_ms)
    VALUES ($1, $2, $3, 'remote', $4, $5, $6, $7)
    ON CONFLICT (workspace_id, key) DO UPDATE
    SET name = EXCLUDED.name, url = EXCLUDED.url, credential_ref = EXCLUDED.credential_ref,
        contract_version = EXCLUDED.contract_version, timeout_ms = EXCLUDED.timeout_ms, updated_at = now()`

/** Stores the tool catalog snapshot of a remote connector. */
export const UPDATE_CATALOG = sql`
    UPDATE public.mcp_connectors
    SET tool_catalog = $3::jsonb, catalog_hash = $4, status = $5, updated_at = now()
    WHERE workspace_id = $1 AND key = $2`

/** Sets the status of a connector, creating the row of a native one. */
export const UPSERT_STATUS = sql`
    INSERT INTO public.mcp_connectors (workspace_id, key, name, kind, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (workspace_id, key) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`

/** The grants of one agent. */
export const LIST_AGENT_GRANTS = sql`
    SELECT tool, mode, limit_vnd, constraints
    FROM public.mcp_tool_grants
    WHERE workspace_id = $1 AND agent_id = $2`

/** Every grant of a workspace with the agent's name. */
export const LIST_WORKSPACE_GRANTS = sql`
    SELECT g.agent_id, a.name AS agent_name, g.tool, g.mode, g.limit_vnd, g.constraints
    FROM public.mcp_tool_grants g
    JOIN public.agents a ON a.id = g.agent_id
    WHERE g.workspace_id = $1
    ORDER BY a.name, g.tool`

/** Sets one grant of an agent of the workspace; answers nothing when the agent is not the workspace's. */
export const UPSERT_GRANT = sql`
    INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode, limit_vnd, constraints, updated_by)
    SELECT $1, a.id, $3, $4, $5, $6::jsonb, $7
    FROM public.agents a
    WHERE a.id = $2 AND a.workspace_id = $1
    ON CONFLICT (agent_id, tool) DO UPDATE
    SET mode = EXCLUDED.mode, limit_vnd = EXCLUDED.limit_vnd, constraints = EXCLUDED.constraints,
        updated_by = EXCLUDED.updated_by, updated_at = now()
    RETURNING id`

/** The agents of a workspace holding a grant of a tool in a mode other than never. */
export const AGENTS_GRANTED = sql`
    SELECT g.agent_id
    FROM public.mcp_tool_grants g
    WHERE g.workspace_id = $1 AND g.tool = ANY($2::text[]) AND g.mode <> 'never'
    ORDER BY g.updated_at`

/** Appends one audit line. */
export const INSERT_CALL_LOG = sql`
    INSERT INTO public.mcp_call_log (workspace_id, connector, tool, agent_id, conversation_id, work_item_id, args_masked,
        args_hash, outcome, error_code, result_summary, duration_ms, approved_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13)`

/** The latest audit lines of a workspace. */
export const LIST_CALL_LOG = sql`
    SELECT l.id, l.tool, coalesce(a.name, '') AS agent_name, l.outcome, l.error_code, l.args_masked::text AS args_masked,
           l.result_summary, l.duration_ms, l.approved_by, l.created_at
    FROM public.mcp_call_log l
    LEFT JOIN public.agents a ON a.id = l.agent_id
    WHERE l.workspace_id = $1
    ORDER BY l.created_at DESC
    LIMIT $2`

/** The agent when it is one of the workspace. */
export const AGENT_OF_WORKSPACE = sql`SELECT a.id FROM public.agents a WHERE a.workspace_id = $1 AND a.id = $2`
