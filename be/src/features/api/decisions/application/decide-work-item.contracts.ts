import type { DecisionVerdict, WireEdits } from "@modules/domain/decisions"
import type { Locale } from "@modules/platform/i18n"

/** What deciding a work item takes. */
export interface DecideWorkItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** What the person changed before approving. */
    readonly edits?: WireEdits
    /** A note from the decider. */
    readonly note?: string
    /** The written reason the outcome is true; required to approve a payment reconciliation. */
    readonly basis?: string
    /** The language of the generated text. */
    readonly locale: Locale
}
