import { sql } from "@modules/platform/database"

/** Hands a conversation to another agent (and that agent's installation) unless a person holds it; answers the row when it moved. */
export const MOVE_CONVERSATION = sql`
    UPDATE public.agent_conversations c
    SET agent_id = $3,
        installation_id = coalesce((SELECT i.id FROM public.module_installations i WHERE i.agent_id = $3 LIMIT 1), c.installation_id)
    WHERE c.id = $2 AND c.workspace_id = $1 AND c.handled_by IS NULL AND c.agent_id <> $3
    RETURNING c.id`

/** Records one ownership move. */
export const INSERT_OWNERSHIP_EVENT = sql`
    INSERT INTO public.conversation_ownership_events (workspace_id, conversation_id, from_agent_id, to_agent_id, reason, remote_stay_id)
    VALUES ($1, $2, $3, $4, $5, $6)`

/** Posts one agent line to the Hub; the room is routed from the agent's home room. */
export const INSERT_HUB_LINE = sql`
    INSERT INTO public.messages (workspace_id, author_kind, author_name, agent_id, body, lead_id, work_item_id)
    SELECT $1, 'agent', a.name, a.id, $3, $4, $5
    FROM public.agents a
    WHERE a.id = $2 AND a.workspace_id = $1
    RETURNING id`

/** Links a channel identity to HAKUEN's guest. */
export const UPSERT_IDENTITY_LINK = sql`
    INSERT INTO public.mcp_identity_links (workspace_id, connector, channel, channel_user_id, lead_id, remote_guest_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (workspace_id, connector, channel, channel_user_id) DO UPDATE
    SET remote_guest_id = EXCLUDED.remote_guest_id, lead_id = coalesce(EXCLUDED.lead_id, public.mcp_identity_links.lead_id),
        linked_at = now()`

/** The display name of an agent of the workspace. */
export const AGENT_NAME = sql`SELECT name FROM public.agents WHERE id = $2 AND workspace_id = $1`
