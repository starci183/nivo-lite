import { sql } from "@modules/platform/database"

/** The workspace's Chatbot installations ($1 workspace). */
export const LIST_CHATBOT_INSTALLATIONS = sql`SELECT id, agent_id FROM public.module_installations
WHERE workspace_id = $1 AND module_key = 'chatbot' ORDER BY created_at LIMIT 100`

/** Every Chatbot agent of the workspace ($1 workspace). */
export const LIST_CHATBOT_AGENTS = sql`SELECT id FROM public.agents WHERE workspace_id = $1 AND module = 'chatbot' LIMIT 100`

/** Customer conversations of the selected agents ($1 workspace, $2 agent ids). */
export const LIST_CHATBOT_CONVERSATIONS = sql`SELECT id, channel, visitor_name, lead_id, handled_by, handled_at, external_id, created_at
FROM public.agent_conversations WHERE workspace_id = $1 AND kind = 'customer' AND agent_id = ANY($2::uuid[])
ORDER BY created_at DESC LIMIT 200`

/** Messages contributing to the inbox figures ($1 workspace, $2 conversation ids, $3 oldest instant). */
export const LIST_CHATBOT_MESSAGE_BRIEFS = sql`SELECT id, conversation_id, role, body, created_at FROM public.agent_messages
WHERE workspace_id = $1 AND conversation_id = ANY($2::uuid[]) AND created_at >= $3::timestamptz
ORDER BY created_at, id LIMIT 6000`

/** Waiting customer-reply work items ($1 workspace). */
export const LIST_CHATBOT_WAITING = sql`SELECT id, subject_id, proposal, assigned_staff_id, created_at FROM public.work_items
WHERE workspace_id = $1 AND action = 'reply_customer' AND status = 'waiting_decision' ORDER BY created_at LIMIT 200`

/** Leads contributing names and capture dates ($1 workspace, $2 lead ids). */
export const LIST_CHATBOT_LEAD_BRIEFS = sql`SELECT id, contact_name, created_at FROM public.leads
WHERE workspace_id = $1 AND id = ANY($2::uuid[]) LIMIT 200`

/** One customer thread of the workspace ($1 workspace, $2 conversation). */
export const FIND_CHATBOT_CONVERSATION = sql`SELECT id, channel, visitor_name, lead_id, handled_by, handled_at, external_id, created_at
FROM public.agent_conversations WHERE workspace_id = $1 AND id = $2 AND kind = 'customer' LIMIT 1`

/** Stored lines of one thread ($1 workspace, $2 conversation). */
export const LIST_CHATBOT_MESSAGES = sql`SELECT id, conversation_id, role, author_kind, author_name, body, created_at, delivery_status, delivery_error
FROM public.agent_messages WHERE workspace_id = $1 AND conversation_id = $2 ORDER BY created_at, id LIMIT 500`

/** The customer lead shown beside a thread ($1 workspace, $2 lead). */
export const FIND_CHATBOT_LEAD = sql`SELECT id, contact_name, company, stage, need, phone, email FROM public.leads
WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** The name of the staff member assigned the open escalation ($1 workspace, $2 staff). */
export const FIND_CHATBOT_STAFF = sql`SELECT name FROM public.staff WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Active agents providing the brain's audience lenses ($1 workspace). */
export const LIST_CHATBOT_LENSES = sql`SELECT module, name FROM public.agents
WHERE workspace_id = $1 AND status = 'active' ORDER BY created_at LIMIT 100`
