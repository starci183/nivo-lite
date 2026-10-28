import { sql } from "@modules/platform/database"

/** The followers who wrote to a Zalo connection after a time, newest first ($1 workspace, $2 connection, $3 since). */
export const LIST_ZALO_RECIPIENTS = sql`SELECT c.external_id, c.visitor_name, max(m.created_at)::text AS last_at
FROM public.agent_conversations c
JOIN public.agent_messages m ON m.conversation_id = c.id AND m.role = 'user'
WHERE c.workspace_id = $1::uuid AND c.connection_id = $2::uuid AND c.channel = 'zalo'
AND c.external_id IS NOT NULL AND m.created_at > $3::timestamptz
GROUP BY c.id
ORDER BY max(m.created_at) DESC
LIMIT 40`

/** The latest messages of the Zalo conversations of a connection, newest first ($1 workspace, $2 connection). */
export const LIST_ZALO_MESSAGE_EVENTS = sql`SELECT m.id, m.role, m.body, m.created_at::text, m.delivery_status, m.delivery_error, c.visitor_name
FROM public.agent_messages m
JOIN public.agent_conversations c ON c.id = m.conversation_id
WHERE c.workspace_id = $1::uuid AND c.connection_id = $2::uuid AND c.channel = 'zalo' AND m.role IN ('user', 'agent')
ORDER BY m.created_at DESC
LIMIT 40`

/** The latest follow events the webhook received for a connection ($1 connection). */
export const LIST_ZALO_FOLLOW_EVENTS = sql`SELECT id, received_at::text
FROM public.zalo_inbox
WHERE payload->>'connection' = $1 AND payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"follow"'
ORDER BY received_at DESC
LIMIT 20`

/** What the inbox holds for a connection: the latest arrival and which events were seen ($1 connection). */
export const FIND_ZALO_INBOX_FACTS = sql`SELECT max(received_at)::text AS last_at,
coalesce(bool_or(payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"user_send_text"'), false) AS has_text,
coalesce(bool_or(payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"follow"'), false) AS has_follow
FROM public.zalo_inbox
WHERE payload->>'connection' = $1`

/** The verdict of the latest reply the agent tried to send on a connection ($1 workspace, $2 connection). */
export const FIND_LAST_ZALO_REPLY = sql`SELECT m.delivery_status, m.delivery_error
FROM public.agent_messages m
JOIN public.agent_conversations c ON c.id = m.conversation_id
WHERE c.workspace_id = $1::uuid AND c.connection_id = $2::uuid AND c.channel = 'zalo' AND m.role = 'agent' AND m.delivery_status IS NOT NULL
ORDER BY m.created_at DESC
LIMIT 1`
