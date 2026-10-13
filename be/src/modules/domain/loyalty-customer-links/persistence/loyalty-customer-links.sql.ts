import { sql } from "@modules/platform/database"

/** Links the customers that own the contact of leads to those leads, moving a link that belonged to another customer ($1 workspace, $2 JSON list of {lead_id, phone, email}). */
export const UPSERT_LEAD_LINKS = sql`INSERT INTO public.loyalty_customer_links (workspace_id, customer_id, kind, ref)
SELECT $1, c.id, 'lead', t.lead_id
FROM jsonb_to_recordset($2::jsonb) AS t(lead_id text, phone text, email text)
JOIN public.loyalty_customers c ON c.workspace_id = $1 AND ((t.phone IS NOT NULL AND c.phone = t.phone) OR (t.phone IS NULL AND c.email = t.email))
ON CONFLICT (workspace_id, kind, ref) DO UPDATE SET customer_id = EXCLUDED.customer_id
RETURNING id`

/** Links every customer to the customer conversations of the leads it is linked to ($1 workspace). */
export const UPSERT_CONVERSATION_LINKS = sql`INSERT INTO public.loyalty_customer_links (workspace_id, customer_id, kind, ref)
SELECT DISTINCT l.workspace_id, l.customer_id, 'conversation', c.id::text
FROM public.loyalty_customer_links l
JOIN public.agent_conversations c ON c.workspace_id = l.workspace_id AND c.lead_id::text = l.ref AND c.kind = 'customer'
WHERE l.workspace_id = $1 AND l.kind = 'lead'
LIMIT 5000
ON CONFLICT (workspace_id, kind, ref) DO UPDATE SET customer_id = EXCLUDED.customer_id`

/** Links every customer to the chat accounts (channel and account) of the conversations it is linked to ($1 workspace). */
export const UPSERT_CHANNEL_LINKS = sql`INSERT INTO public.loyalty_customer_links (workspace_id, customer_id, kind, ref)
SELECT DISTINCT l.workspace_id, l.customer_id, 'channel', c.channel || ':' || split_part(c.external_id, ':', 1)
FROM public.loyalty_customer_links l
JOIN public.agent_conversations c ON c.workspace_id = l.workspace_id AND c.id::text = l.ref AND c.kind = 'customer'
WHERE l.workspace_id = $1 AND l.kind = 'conversation' AND c.channel IS NOT NULL AND c.external_id IS NOT NULL
LIMIT 5000
ON CONFLICT (workspace_id, kind, ref) DO UPDATE SET customer_id = EXCLUDED.customer_id`

/** How many of some customers can be written to in their own chat: a conversation of theirs that no staff member handles ($1 workspace, $2 customers). */
export const COUNT_REACHABLE = sql`SELECT count(DISTINCT l.customer_id)::int AS total
FROM public.loyalty_customer_links l
JOIN public.agent_conversations c ON c.workspace_id = l.workspace_id AND c.kind = 'customer' AND c.handled_by IS NULL
  AND ((l.kind = 'conversation' AND c.id::text = l.ref) OR (l.kind = 'lead' AND c.lead_id::text = l.ref))
WHERE l.workspace_id = $1 AND l.customer_id = ANY($2::uuid[])`

/** The newest chat of a customer, a push channel (Telegram or Zalo) first ($1 workspace, $2 customer). */
export const SELECT_PUSH_CONVERSATION = sql`SELECT c.id, c.channel
FROM public.loyalty_customer_links l
JOIN public.agent_conversations c ON c.workspace_id = l.workspace_id AND c.kind = 'customer'
  AND ((l.kind = 'conversation' AND c.id::text = l.ref) OR (l.kind = 'lead' AND c.lead_id::text = l.ref))
WHERE l.workspace_id = $1 AND l.customer_id = $2
ORDER BY (c.channel IN ('telegram', 'zalo')) DESC, c.created_at DESC
LIMIT 1`
