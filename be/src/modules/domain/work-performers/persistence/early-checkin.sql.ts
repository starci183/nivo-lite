import { sql } from "@modules/platform/database"

/** The latest customer conversation of the channel identity NIVO linked to a HAKUEN guest. */
export const FIND_LINKED_CONVERSATION = sql`
    SELECT c.id
    FROM public.mcp_identity_links l
    JOIN public.agent_conversations c
      ON c.workspace_id = l.workspace_id AND c.kind = 'customer' AND c.channel = l.channel
     AND (c.external_id = l.channel_user_id OR c.external_id LIKE l.channel_user_id || ':%')
    WHERE l.workspace_id = $1 AND l.connector = 'hakuen' AND l.remote_guest_id = $2
    ORDER BY c.created_at DESC
    LIMIT 1`
