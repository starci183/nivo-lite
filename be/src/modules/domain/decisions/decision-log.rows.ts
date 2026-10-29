import type { DeciderKind, DecisionOutcome } from "./decisions.contracts"

/** A decision's lineage in the accounting book. */
export interface AccountingDecisionRow {
    /** The decision id. */
    readonly id: string
    /** The work item it decided. */
    readonly work_item_id: string | null
    /** The action key. */
    readonly action: string
    /** Who decided. */
    readonly decided_by: string
    /** Policy, owner or staff. */
    readonly decider_kind: DeciderKind
    /** The decision's outcome. */
    readonly outcome: DecisionOutcome
    /** The decider's note. */
    readonly note: string | null
    /** When it was written, ISO text. */
    readonly created_at: string
}
