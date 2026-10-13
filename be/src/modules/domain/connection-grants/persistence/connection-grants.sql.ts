import { sql } from "@modules/platform/database"

/** The agents of a workspace among the given ids. */
export const FIND_AGENTS = sql`SELECT id, name, module FROM public.agents WHERE workspace_id = $1 AND id = ANY($2::uuid[])`

/** The current grants among the given agents and connections. */
export const FIND_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND agent_id = ANY($2::uuid[]) AND connection_id = ANY($3::uuid[])`

/** Every grant of one connection. */
export const FIND_CONNECTION_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND connection_id = $2`

/** Every grant of one agent. */
export const FIND_AGENT_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 AND agent_id = $2`

/** Removes the access of an agent to a connection. */
export const DELETE_GRANT = sql`DELETE FROM public.agent_connections WHERE workspace_id = $1 AND agent_id = $2 AND connection_id = $3`

/** Gives or changes the access of an agent to a connection. */
export const UPSERT_GRANT = sql`INSERT INTO public.agent_connections (agent_id, connection_id, workspace_id, purpose, access) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (agent_id, connection_id) DO UPDATE SET purpose = excluded.purpose, access = excluded.access`

/** Logs one change of access: who, when, before, after. */
export const INSERT_ACCESS_LOG = sql`INSERT INTO public.agent_access_log (workspace_id, connection_id, agent_id, connection_name, agent_name, before_access, after_access, changed_by, changed_by_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`

/** Every grant of the workspace. */
export const LIST_WORKSPACE_GRANTS = sql`SELECT agent_id, connection_id, access FROM public.agent_connections WHERE workspace_id = $1 ORDER BY created_at LIMIT 500`
