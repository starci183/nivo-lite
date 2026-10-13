import { sql } from "@modules/platform/database"

/** Customer conversations linked to leads ($1 workspace, $2 limit). */
export const LIST_CUSTOMER_LEAD_CONVERSATIONS = sql`
    SELECT id, lead_id, handled_by FROM public.agent_conversations
    WHERE workspace_id = $1::uuid AND kind = 'customer' AND lead_id IS NOT NULL
    ORDER BY created_at DESC, id DESC LIMIT $2::int`
