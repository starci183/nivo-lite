import { sql } from "@modules/platform/database"

/** The newest lines of the decision log with the customer name; a null filter ($2 kinds, $3 outcome, $4 module) does not narrow. */
export const LIST_DECISION_HISTORY = sql`
    SELECT d.id, d.work_item_id, d.lead_id, l.contact_name AS "leadName", d.department, d.action, d.decided_by,
           d.decider_kind, d.outcome, d.reason, d.note, to_json(d.created_at) #>> '{}' AS created_at
    FROM public.decisions d
    LEFT JOIN public.leads l ON l.id = d.lead_id
    WHERE d.workspace_id = $1
      AND ($2::text[] IS NULL OR d.decider_kind = ANY($2::text[]))
      AND ($3::text IS NULL OR d.outcome = $3::text)
      AND ($4::text IS NULL OR d.department = $4::text)
    ORDER BY d.created_at DESC, d.id DESC
    LIMIT $5`
