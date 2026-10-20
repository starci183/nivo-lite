import { sql } from "@modules/platform/database"

/** Appends one line to the Office thread. */
export const INSERT_MESSAGE = sql`
    INSERT INTO public.messages (workspace_id, author_kind, author_name, agent_id, body, lead_id, work_item_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`

/** Appends one result card line to the Office thread and answers its id; a null room is routed by the database. */
export const INSERT_CARD_MESSAGE = sql`
    INSERT INTO public.messages (workspace_id, author_kind, author_name, agent_id, body, lead_id, work_item_id, room, card)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
    RETURNING id, room`
