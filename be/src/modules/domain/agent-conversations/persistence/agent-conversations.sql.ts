import { sql } from "@modules/platform/database"

/** The conversation of one customer on one connection ($1 workspace, $2 channel, $3 connection, $4 customer id on the channel). */
export const FIND_CONVERSATION = sql`SELECT id, agent_id, lead_id, handled_by, visitor_name
FROM public.agent_conversations
WHERE workspace_id = $1 AND channel = $2 AND connection_id = $3 AND external_id = $4
ORDER BY created_at DESC
LIMIT 1`

/** Opens a conversation of a customer on a connection ($1 workspace, $2 agent, $3 channel, $4 customer id, $5 visitor name, $6 connection). */
export const INSERT_CONVERSATION = sql`INSERT INTO public.agent_conversations (workspace_id, agent_id, kind, channel, external_id, visitor_name, connection_id)
VALUES ($1, $2, 'customer', $3, $4, $5, $6)
RETURNING id, agent_id, lead_id, handled_by, visitor_name`

/** "/start" opens a fresh visit: the previous conversation stays in history under an archived id ($1 workspace, $2 channel, $3 connection, $4 customer id, $5 archived id). */
export const ARCHIVE_CONVERSATION = sql`UPDATE public.agent_conversations
SET external_id = $5
WHERE workspace_id = $1 AND channel = $2 AND connection_id = $3 AND external_id = $4`

/** The bindings changed since the chat began: it follows the connection's current front door ($1 conversation, $2 agent). */
export const REBIND_CONVERSATION_AGENT = sql`UPDATE public.agent_conversations
SET agent_id = $2
WHERE id = $1`

/** Names the customer of a conversation ($1 conversation id, $2 name). */
export const UPDATE_VISITOR_NAME = sql`UPDATE public.agent_conversations
SET visitor_name = $2
WHERE id = $1`

/** Where a conversation's replies go ($1 conversation id). */
export const FIND_CONVERSATION_TARGET = sql`SELECT id, workspace_id, channel, external_id, connection_id
FROM public.agent_conversations
WHERE id = $1
LIMIT 1`

/** The conversation a turn answers, joined with the agent that speaks in it ($1 conversation id). */
export const FIND_TURN_CONVERSATION = sql`SELECT c.id, c.workspace_id, c.channel, c.external_id, c.connection_id, c.lead_id, c.handled_by, c.visitor_name, c.installation_id,
       a.id AS agent_id, a.name AS agent_name, a.handle AS agent_handle, a.role AS agent_role, a.module AS agent_module,
       a.instructions AS agent_instructions, a.knowledge AS agent_knowledge, a.approval_rule AS agent_approval_rule, a.greeting AS agent_greeting
FROM public.agent_conversations c
JOIN public.agents a ON a.id = c.agent_id
WHERE c.id = $1
LIMIT 1`
