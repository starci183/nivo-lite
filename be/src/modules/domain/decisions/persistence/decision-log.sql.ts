import { sql } from "@modules/platform/database"

/** The newest accounting decisions' lineage ($1 workspace, $2 how many). */
export const LIST_ACCOUNTING_DECISIONS = sql`
    SELECT id, work_item_id, action, decided_by, decider_kind, outcome, note,
           to_json(created_at) #>> '{}' AS created_at
    FROM public.decisions
    WHERE workspace_id = $1::uuid AND department = 'accounting'
    ORDER BY created_at DESC, id DESC LIMIT $2::int`

/** Appends a line to the decision log of the workspace. */
export const INSERT_DECISION = sql`
    INSERT INTO public.decisions (workspace_id, work_item_id, lead_id, department, action, decided_by, decider_kind, outcome,
                                  reason, note, before, after)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`
