import { sql } from "@modules/platform/database"

/** The audit lines of an agent's gateway calls ($1 agent). */
export const MCP_CALLS_OF_AGENT = sql`SELECT tool, outcome FROM public.mcp_call_log WHERE agent_id = $1 LIMIT 10`

/** Deletes one agent; its keys go with it ($1 agent). */
export const DELETE_AGENT = sql`DELETE FROM public.agents WHERE id = $1`
