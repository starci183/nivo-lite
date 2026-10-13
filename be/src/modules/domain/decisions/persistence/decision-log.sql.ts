import { sql } from "@modules/platform/database"

/** Appends a line to the decision log of the workspace. */
export const INSERT_DECISION = sql`
    INSERT INTO public.decisions (workspace_id, work_item_id, lead_id, department, action, decided_by, decider_kind, outcome,
                                  reason, note, before, after)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`
