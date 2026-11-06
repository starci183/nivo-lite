import type { DecisionRecord } from "./decisions-views.contracts"

/** The authoritative principal behind the latest decision of one work item, separate from its display label. */
export interface DecisionActorRow {
    /** The work item decided. */
    readonly workItemId: string
    /** The workspace member recorded by the decision, or null for a legacy or policy-only record. */
    readonly memberId: string | null
}

/** A row of the decision log before the customer name is read. */
export interface DecisionLogRow extends DecisionRecord {
    /** The instant of the row as fixed-width UTC text, to order rows of different sources at full precision. */
    readonly sort_key: string
}
