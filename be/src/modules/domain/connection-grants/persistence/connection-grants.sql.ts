import { sql } from "@modules/platform/database"

/** The agents of a workspace among the given ids. */
export const FIND_AGENTS = sql`SELECT id, name, module FROM public.agents WHERE workspace_id = $1 AND id = ANY($2::uuid[]) LIMIT 500`

/** The current grants among the given agents and connections. */
export const FIND_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND agent_id = ANY($2::uuid[]) AND connection_id = ANY($3::uuid[]) LIMIT 500`

/** Every grant of one connection. */
export const FIND_CONNECTION_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND connection_id = $2 LIMIT 500`

/** Every grant of one agent. */
export const FIND_AGENT_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND agent_id = $2 LIMIT 500`

/** Every grant of the workspace. */
export const LIST_WORKSPACE_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 ORDER BY created_at LIMIT 500`
