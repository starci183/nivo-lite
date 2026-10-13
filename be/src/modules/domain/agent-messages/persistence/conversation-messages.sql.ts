import { sql } from "@modules/platform/database"

/** Messages of selected conversations, fenced to the workspace ($1 workspace, $2 ids, $3 since, $4 oldest first, $5 limit). */
export const LIST_CONVERSATION_MESSAGES = sql`
    SELECT conversation_id, role, body, to_json(created_at) #>> '{}' AS created_at
    FROM public.agent_messages
    WHERE workspace_id = $1::uuid AND conversation_id = ANY($2::uuid[])
      AND ($3::timestamptz IS NULL OR created_at >= $3::timestamptz)
    ORDER BY CASE WHEN $4::boolean THEN created_at END ASC,
             CASE WHEN NOT $4::boolean THEN created_at END DESC, id ASC
    LIMIT $5::int`
