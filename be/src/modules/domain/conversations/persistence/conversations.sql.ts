import { sql } from "@modules/platform/database"

/** The front-door agent bound to a connection: an active chatbot, booking or loyalty agent that may act, chatbot first, oldest first ($1 connection id). */
export const FIND_FRONT_AGENT = sql`SELECT a.id, a.greeting
FROM public.agent_connections l
JOIN public.agents a ON a.id = l.agent_id
WHERE l.connection_id = $1
  AND l.purpose = 'inbound_chat'
  AND l.access <> 'read'
  AND a.status = 'active'
  AND a.module = ANY (ARRAY['chatbot', 'booking', 'loyalty'])
ORDER BY array_position(ARRAY['chatbot', 'booking', 'loyalty'], a.module), a.created_at
LIMIT 1`

/** The owner's own holding line for an agent, from its module installation ($1 workspace, $2 agent id). */
export const FIND_HOLDING_SETTING = sql`SELECT settings ->> 'holdingMessage' AS holding_message
FROM public.module_installations
WHERE workspace_id = $1 AND agent_id = $2
LIMIT 1`
