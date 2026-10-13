import { sql } from "@modules/platform/database"

/** Workspace decision history, optionally one lead or one department's human decisions ($1 workspace, $2 lead, $3 human department, $4 oldest first, $5 limit). */
export const LIST_DECISION_HISTORY = sql`
    SELECT d.id, d.work_item_id, d.lead_id, l.contact_name AS "leadName", d.department, d.action,
           d.decided_by, d.decider_kind, d.outcome, d.reason, d.note,
           to_json(d.created_at) #>> '{}' AS created_at
    FROM public.decisions d
    LEFT JOIN public.leads l ON l.id = d.lead_id AND l.workspace_id = d.workspace_id
    WHERE d.workspace_id = $1::uuid AND ($2::uuid IS NULL OR d.lead_id = $2::uuid)
      AND ($3::text IS NULL OR (d.department = $3 AND d.decider_kind IN ('owner', 'staff')))
    ORDER BY CASE WHEN $4::boolean THEN d.created_at END ASC,
             CASE WHEN NOT $4::boolean THEN d.created_at END DESC, d.id ASC
    LIMIT $5::int`
