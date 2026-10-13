import { sql } from "@modules/platform/database"

/** The active agents bound to a connection for any of the purposes, with the binding ($1 connection, $2 purposes). */
export const LIST_AGENTS_OF_CONNECTION = sql`SELECT a.id, a.module, a.name, a.created_at, ac.access, ac.purpose
FROM public.agent_connections ac
JOIN public.agents a ON a.id = ac.agent_id
WHERE ac.connection_id = $1 AND ac.purpose = ANY($2::text[]) AND a.status = 'active'
ORDER BY a.created_at, a.id
LIMIT 200`

/** The connections an agent is bound to for any of the purposes, with the binding ($1 agent, $2 purposes). */
export const LIST_CONNECTIONS_OF_AGENT = sql`SELECT c.id, c.provider, c.name, c.status, c.created_at, ac.access, ac.purpose,
       NULLIF(btrim(c.public_meta ->> 'bot_username'), '') AS bot_username,
       NULLIF(btrim(c.public_meta ->> 'account_masked'), '') AS account_masked
FROM public.agent_connections ac
JOIN public.connections c ON c.id = ac.connection_id
WHERE ac.agent_id = $1 AND ac.purpose = ANY($2::text[])
ORDER BY c.created_at, c.id
LIMIT 200`

/** Grants (or changes the grant of) a connection to an agent of the same workspace; answers the agent id, nothing when either is not in the workspace ($1 agent, $2 connection, $3 workspace, $4 purpose, $5 access). */
export const UPSERT_BINDING = sql`INSERT INTO public.agent_connections (agent_id, connection_id, workspace_id, purpose, access)
SELECT a.id, c.id, a.workspace_id, $4, $5
FROM public.agents a
JOIN public.connections c ON c.workspace_id = a.workspace_id
WHERE a.id = $1 AND c.id = $2 AND a.workspace_id = $3
ON CONFLICT (agent_id, connection_id) DO UPDATE SET purpose = EXCLUDED.purpose, access = EXCLUDED.access
RETURNING agent_id`

/** Removes the grant of a connection to an agent ($1 agent, $2 connection, $3 workspace). */
export const DELETE_BINDING = sql`DELETE FROM public.agent_connections WHERE agent_id = $1 AND connection_id = $2 AND workspace_id = $3`

/** The connections an agent of the workspace is bound to for any of the purposes ($1 agent, $2 workspace, $3 purposes). */
export const LIST_CONNECTIONS_OF_WORKSPACE_AGENT = sql`SELECT c.id, c.provider, c.name, c.status, c.created_at, ac.access, ac.purpose,
       NULLIF(btrim(c.public_meta ->> 'bot_username'), '') AS bot_username,
       NULLIF(btrim(c.public_meta ->> 'account_masked'), '') AS account_masked
FROM public.agent_connections ac
JOIN public.connections c ON c.id = ac.connection_id
WHERE ac.agent_id = $1 AND ac.workspace_id = $2 AND ac.purpose = ANY($3::text[])
ORDER BY c.created_at, c.id
LIMIT 200`
