import { sql } from "@modules/platform/database"

/** Posts one line a member typed in the Office thread and answers it ($1 workspace, $2 author name, $3 staff or null, $4 body, $5 room or null, $6 proven user id). */
export const INSERT_HUMAN_MESSAGE = sql`
    INSERT INTO public.messages (workspace_id, author_kind, author_name, staff_id, body, room, author_user_id)
    VALUES ($1, 'human', $2, $3, $4, $5, $6)
    RETURNING id, author_kind, author_name, author_user_id::text AS author_user_id, agent_id, staff_id, body, lead_id, work_item_id, room,
              to_json(created_at) #>> '{}' AS created_at`
