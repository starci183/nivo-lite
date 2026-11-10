import type { Locale } from "@modules/platform/i18n"

/** Which customer the pages ask about: a lead (the lead page) or a run (the run page). */
export interface ReadLeadFreezeRequest {
    /** The workspace the caller names in X-Workspace-Id; the handler proves the seat. */
    readonly workspaceId: string
    /** The lead, when the lead page asks. */
    readonly leadId?: string | undefined
    /** The run, when the run page asks. */
    readonly runId?: string | undefined
}

/** Whether the customer waits for the owner to handle a failed run. */
export interface LeadFreezeView {
    /** The freeze. */
    readonly id: string
    /** `frozen` or `retrying`. */
    readonly status: string
    /** The workflow whose run stopped, the only one the freeze holds; null for a freeze that holds the customer as a whole. */
    readonly workflowId: string | null
    /** The lead, or null. */
    readonly leadId: string | null
    /** The run that failed, or null. */
    readonly runId: string | null
    /** The title of the failed step, or null. */
    readonly stepTitle: string | null
    /** The error code, or null. */
    readonly reason: string | null
    /** The owner's item, or null. */
    readonly workItemId: string | null
    /** How many events wait. */
    readonly pendingCount: number
    /** Who took the conversation over, or null. */
    readonly heldBy: string | null
}

/** The view, or null when nothing holds the customer. */
export type OptionalLeadFreezeView = LeadFreezeView | null

/** The owner's answer to a frozen customer. */
export interface DecideLeadFreezeRequest {
    /** The workspace the caller names in X-Workspace-Id. */
    readonly workspaceId: string
    /** The freeze. */
    readonly freezeId: string
    /** The answer: `retry`, `take_over` or `skip`; the domain refuses any other. */
    readonly action: string
    /** The language of the decision log. */
    readonly locale: Locale
}

/** How the answer ended: `on_stop` (a stop holds the customer: answer the stop) or `not_found`. Kept as a shell for the pages. */
export interface DecideLeadFreezeOutcome {
    /** The outcome. */
    readonly outcome: string
}
