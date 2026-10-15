import type { Correction } from "@modules/domain/brain"
import type { CorrectionRow } from "./persistence/corrections.rows"

/** Retains the decision's proposals and note while naming its identity and instant for learning. */
export const toCorrection = (row: CorrectionRow): Correction => ({
    decisionId: row.id,
    action: row.action,
    outcome: row.outcome,
    note: row.note,
    at: row.created_at,
    before: row.before,
    after: row.after,
})
