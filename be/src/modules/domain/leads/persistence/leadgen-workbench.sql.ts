import { sql } from "@modules/platform/database"

/** Latest leads of the workspace, matching the existing workbench's bounded read. */
export const LIST_LEADGEN_LEADS = sql`
    SELECT id, contact_name, company, channel, need, stage, installation_id,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.leads WHERE workspace_id = $1
    ORDER BY created_at DESC LIMIT 500`

/** Capture, scoring, public-comment and sales-handoff records in their original newest-first order. */
export const LIST_LEADGEN_ITEMS = sql`
    SELECT id, department, action, lead_id, installation_id, status, proposal,
           to_json(created_at) #>> '{}' AS created_at, to_json(completed_at) #>> '{}' AS completed_at
    FROM public.work_items WHERE workspace_id = $1
    ORDER BY created_at DESC LIMIT 600`

/** Conversations with a captured customer; only these contribute last messages and reply times. */
export const LIST_LEADGEN_CONVERSATIONS = sql`
    SELECT id, lead_id FROM public.agent_conversations
    WHERE workspace_id = $1 AND kind = 'customer' AND lead_id IS NOT NULL LIMIT 1000`

/** Messages in the conversion window, oldest first. */
export const LIST_LEADGEN_MESSAGES = sql`
    SELECT conversation_id, role, body, to_json(created_at) #>> '{}' AS created_at
    FROM public.agent_messages WHERE workspace_id = $1 AND created_at >= $2::timestamptz
    ORDER BY created_at ASC LIMIT 8000`
