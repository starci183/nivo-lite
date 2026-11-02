import type { DecisionRecord } from "./decisions-views.contracts"
import type { DeciderKind, DecisionOutcome } from "./decisions.contracts"

/** The authoritative principal behind the latest decision of one work item, separate from its display label. */
export interface DecisionActorRow {
    /** The work item decided. */
    readonly workItemId: string
    /** The workspace member recorded by the decision, or null for a legacy or policy-only record. */
    readonly memberId: string | null
}

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

/** A row of the decision log before the customer name is read. */
export interface DecisionLogRow extends Omit<DecisionRecord, "leadName"> {
    /** The instant of the row as fixed-width UTC text, to order rows of different sources at full precision. */
    readonly sort_key: string
}
