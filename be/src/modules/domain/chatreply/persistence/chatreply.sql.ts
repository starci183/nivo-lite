import { sql } from "@modules/platform/database"

/** A member's reply with its delivery job; the conversation and message must both belong to the workspace ($1 workspace, $2 message). */
export const FIND_REPLY_PROGRESS = sql`SELECT m.id, m.delivery_status, o.state AS job_state
FROM public.agent_messages m
JOIN public.agent_conversations c ON c.id = m.conversation_id AND c.workspace_id = m.workspace_id
LEFT JOIN LATERAL public.job_status(m.workspace_id, 'chat_turn', 'chat-turn.deliver', 'chat-turn.deliver:' || m.id::text) o ON true
WHERE m.workspace_id = $1::uuid AND m.id = $2::uuid AND m.author_kind = 'human' AND c.kind = 'customer'
LIMIT 1`

/** A conversation escalation with its existing decision job and precisely correlated answer message ($1 workspace, $2 work item). */
export const FIND_ANSWER_PROGRESS = sql`SELECT w.id, w.status AS work_status, m.id AS message_id, m.delivery_status, o.state AS job_state
FROM public.work_items w
JOIN public.agent_conversations c ON c.id::text = COALESCE(NULLIF(w.proposal -> 'fields' ->> 'conversation_id', ''), CASE WHEN w.subject_type = 'conversation' THEN w.subject_id::text ELSE NULL END) AND c.workspace_id = w.workspace_id AND c.kind = 'customer'
LEFT JOIN public.agent_messages m ON m.id = w.id AND m.workspace_id = w.workspace_id AND m.conversation_id = c.id AND m.author_kind = 'human'
LEFT JOIN LATERAL public.job_status(w.workspace_id, 'decisions', 'decisions.decide-work', 'decisions.decide-work:' || w.id::text) o ON true
WHERE w.workspace_id = $1::uuid AND w.id = $2::uuid AND w.action = 'reply_customer'
LIMIT 1`
