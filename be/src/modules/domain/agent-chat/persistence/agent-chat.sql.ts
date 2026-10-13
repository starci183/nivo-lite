import { sql } from "@modules/platform/database"

/** The scoped agent facts ($1 workspace, $2 agent). */
export const FIND_CHAT_AGENT = sql`SELECT id, module, status, greeting FROM public.agents
WHERE workspace_id = $1::uuid AND id = $2::uuid LIMIT 1`

/** The purchase qualifying for the campaign ($1 workspace, $2 starts, $3 ends). */
export const FIND_FOUNDING_PURCHASE = sql`SELECT id FROM public.events
WHERE workspace_id = $1::uuid AND kind = 'module.purchased' AND created_at >= $2::timestamptz AND created_at <= $3::timestamptz LIMIT 1`

/** A scoped submission and any reply written for it ($1 workspace, $2 message). */
export const FIND_CHAT_TURN_MESSAGE = sql`SELECT m.id, m.conversation_id, c.channel, m.role, m.delivery_status,
r.id AS reply_id, r.delivery_status AS reply_delivery_status
FROM public.agent_messages m
JOIN public.agent_conversations c ON c.id = m.conversation_id AND c.workspace_id = m.workspace_id
LEFT JOIN public.agent_messages r ON r.conversation_id = m.conversation_id AND r.workspace_id = m.workspace_id AND r.in_reply_to = m.id AND r.role = 'agent'
WHERE m.workspace_id = $1::uuid AND m.id = $2::uuid AND m.role IN ('user', 'agent') LIMIT 1`
