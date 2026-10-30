import type { DecisionRecord } from "./decisions-views.contracts"
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

/** What the decision log is narrowed to; a null filter does not narrow. */
export interface DecisionLogFilter {
    /** The deciders to keep (`policy`, `owner`, `staff`). */
    readonly deciders: ReadonlyArray<string> | null
    /** The outcome to keep. */
    readonly outcome: string | null
    /** The module to keep. */
    readonly department: string | null
    /** The most lines. */
    readonly limit: number
}

/** A line of the decision log before the customer name is read; `sort_key` orders lines of different sources at full precision. */
export type DecisionLogLine = Omit<DecisionRecord, "leadName"> & { readonly sort_key: string }
