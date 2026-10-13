import { sql } from "@modules/platform/database"

/** Appends a line to the workspace's evidence log ($1 workspace, $2 kind, $3 actor, $4 summary, $5 lead or null, $6 work item or null, $7 evidence or null). */
export const INSERT_EVENT = sql`
    INSERT INTO public.events (workspace_id, kind, actor, summary, lead_id, work_item_id, evidence)
    VALUES ($1, $2, $3, $4, $5, $6, $7)`

/** The first lines of a customer's evidence history, oldest first ($1 workspace, $2 lead, $3 how many). */
export const LIST_LEAD_EVENTS = sql`
    SELECT summary, evidence FROM public.events
    WHERE workspace_id = $1::uuid AND lead_id = $2::uuid
    ORDER BY created_at LIMIT $3::int`

/** Bounded workspace history ($1 workspace, $2 lead or null, $3 kind or null, $4 work-item ids or null, $5 oldest first, $6 limit). */
export const LIST_EVENTS = sql`
    SELECT id, lead_id, kind, actor, summary, evidence,
           to_json(created_at)#>>'{}' AS created_at, work_item_id
    FROM public.events
    WHERE workspace_id = $1::uuid
      AND ($2::uuid IS NULL OR lead_id = $2::uuid)
      AND ($3::text IS NULL OR kind = $3::text)
      AND ($4::uuid[] IS NULL OR work_item_id = ANY($4::uuid[]))
    ORDER BY CASE WHEN $5::boolean THEN created_at END ASC,
             CASE WHEN NOT $5::boolean THEN created_at END DESC, id
    LIMIT $6::int`
