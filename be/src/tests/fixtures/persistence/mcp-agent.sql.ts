import { sql } from "@modules/platform/database"

/** The audit lines of an agent's gateway calls ($1 agent). */
export const MCP_CALLS_OF_AGENT = sql`SELECT tool, outcome FROM public.mcp_call_log WHERE agent_id = $1 LIMIT 10`

/** Deletes one agent; its keys go with it ($1 agent). */
export const DELETE_AGENT = sql`DELETE FROM public.agents WHERE id = $1`

/** Grants an agent every tool of a connector in auto mode ($1 workspace, $2 agent, $3 `<connector>.*`). */
export const GRANT_CONNECTOR_TOOLS = sql`INSERT INTO public.mcp_tool_grants (workspace_id, agent_id, tool, mode) VALUES ($1, $2, $3, 'auto')`

/** The stored credential columns of one connector, as the database holds them ($1 workspace, $2 key). */
export const STORED_CREDENTIAL_OF = sql`SELECT credential_state, credential_sealed, credential_set_by FROM public.mcp_connectors WHERE workspace_id = $1 AND key = $2 LIMIT 1`
