import type { Locale } from "@modules/platform/i18n"
import type { WorkEdits } from "./decisions.contracts"

/** What a person decides about a waiting item. */
export type DecisionVerdict = "approved" | "rejected"

/** A text that may be absent. */
export type OptionalNote = string | null

/** What deciding a work item takes. */
export interface DecideWorkRequest {
    /** The work item. */
    readonly workItemId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** What the person changed before approving. */
    readonly edits: WorkEdits
    /** A note from the decider. */
    readonly note: OptionalNote
    /** The written reason the outcome is true; required to approve a payment reconciliation. */
    readonly basis: OptionalNote
    /** The language of the generated text. */
    readonly locale: Locale
}

/** What deciding an approval card takes. */
export interface DecideExecutionRequest {
    /** The approval card. */
    readonly executionId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** The draft the person edited, when they did. */
    readonly editedDraft: OptionalNote
    /** The language of the generated text. */
    readonly locale: Locale
}

/** Who is assigned to an item, in the terms the role policy reads. */
export interface DecisionAssignee {
    /** `staff` when a staff member is assigned, else null. */
    readonly assigneeKind: string | null
    /** The assigned staff id. */
    readonly assigneeId: string | null
}
