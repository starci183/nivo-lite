import { sql } from "@modules/platform/database"

/** Stores what the customer wrote ($1 workspace, $2 conversation, $3 body). */
export const INSERT_CUSTOMER_MESSAGE = sql`INSERT INTO public.agent_messages (workspace_id, conversation_id, role, body)
VALUES ($1, $2, 'user', $3)
RETURNING id`

/** Stores the greeting the agent opens a visit with ($1 workspace, $2 conversation, $3 body). */
export const INSERT_GREETING_MESSAGE = sql`INSERT INTO public.agent_messages (workspace_id, conversation_id, role, body)
VALUES ($1, $2, 'agent', $3)
RETURNING id`

/** Stores the agent's reply to one customer message exactly once; a second attempt returns nothing ($1 workspace, $2 conversation, $3 body, $4 customer message id). */
export const INSERT_AGENT_REPLY = sql`INSERT INTO public.agent_messages (workspace_id, conversation_id, role, body, in_reply_to)
VALUES ($1, $2, 'agent', $3, $4)
ON CONFLICT (conversation_id, in_reply_to) WHERE role = 'agent' AND in_reply_to IS NOT NULL DO NOTHING
RETURNING id`

/** The agent reply already stored for a customer message, with its delivery verdict ($1 conversation, $2 customer message id). */
export const FIND_AGENT_REPLY = sql`SELECT id, body, delivery_status
FROM public.agent_messages
WHERE conversation_id = $1 AND in_reply_to = $2 AND role = 'agent'
LIMIT 1`

/** Writes a line the workbench shows between the messages, never sent to the customer ($1 workspace, $2 conversation, $3 body). */
export const INSERT_SYSTEM_LINE = sql`INSERT INTO public.agent_messages (workspace_id, conversation_id, role, body)
VALUES ($1, $2, 'system', $3)`

/** The text of one stored message of a conversation ($1 message id, $2 conversation id). */
export const FIND_MESSAGE = sql`SELECT id, role, body, delivery_status
FROM public.agent_messages
WHERE id = $1 AND conversation_id = $2
LIMIT 1`

/** The recent transcript of a conversation without system lines, oldest first ($1 conversation id). */
export const LIST_TRANSCRIPT = sql`SELECT role, body
FROM (
    SELECT role, body, created_at
    FROM public.agent_messages
    WHERE conversation_id = $1 AND role <> 'system'
    ORDER BY created_at DESC
    LIMIT 40
) recent
ORDER BY created_at
LIMIT 40`

/** When the customer last wrote in a conversation ($1 conversation id). */
export const FIND_LAST_CUSTOMER_MESSAGE = sql`SELECT created_at
FROM public.agent_messages
WHERE conversation_id = $1 AND role = 'user'
ORDER BY created_at DESC
LIMIT 1`

/** Writes the verdict of a delivery on the stored agent message ($1 message id, $2 status, $3 error). */
export const MARK_MESSAGE_DELIVERY = sql`UPDATE public.agent_messages
SET delivery_status = $2, delivery_error = $3
WHERE id = $1`

/** The bounded thread in its proven workspace ($1 workspace, $2 conversation). */
export const LIST_CHAT_MESSAGES = sql`SELECT id, role, body, created_at::text FROM public.agent_messages
WHERE workspace_id = $1::uuid AND conversation_id = $2::uuid ORDER BY created_at, id LIMIT 300`

/** Stores a human reply; an approved answer uses its work item id so retries reuse one message ($1 id or null, $2 workspace, $3 conversation, $4 body, $5 member name). */
export const INSERT_HUMAN_MESSAGE = sql`INSERT INTO public.agent_messages (id, workspace_id, conversation_id, role, body, author_kind, author_name)
VALUES (COALESCE($1::uuid, gen_random_uuid()), $2::uuid, $3::uuid, 'agent', $4, 'human', $5)
ON CONFLICT (id) DO NOTHING
RETURNING id`

/**
 * The messages customers wrote to a workspace per Vietnam day and channel, between two days ($1 workspace, $2 from inclusive,
 * $3 to exclusive, both `YYYY-MM-DD` in Vietnam time). Only the customer side of real customer conversations is counted.
 */
export const COUNT_CUSTOMER_MESSAGES_PER_DAY = sql`SELECT c.channel,
to_char((m.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day, count(*)::integer AS messages
FROM public.agent_messages m
JOIN public.agent_conversations c ON c.id = m.conversation_id AND c.workspace_id = m.workspace_id
WHERE m.workspace_id = $1 AND m.role = 'user' AND c.kind = 'customer' AND c.channel IN ('facebook', 'zalo')
AND m.created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
AND m.created_at < ($3::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
GROUP BY 1, 2
ORDER BY 2, 1
LIMIT 400`
