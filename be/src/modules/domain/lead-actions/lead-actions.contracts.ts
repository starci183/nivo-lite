/** The supported asynchronous lead actions. */
export type LeadAction = "create" | "refresh-context" | "suggest-owner" | "draft-execution" | "settle-won"

/** The action's bounded input, validated by its GraphQL door. */
export interface LeadActionInput {
    /** The customer name for a capture. */
    readonly contactName?: string
    /** The company for a capture. */
    readonly company?: string
    /** The channel label for a capture. */
    readonly channel?: string
    /** What the customer needs. */
    readonly need?: string
    /** The optional phone. */
    readonly phone?: string | null | undefined
    /** The optional email. */
    readonly email?: string | null | undefined
    /** The lead an action addresses. */
    readonly leadId?: string
    /** The responsibility to draft. */
    readonly responsibilityId?: string
    /** Why the deal was won. */
    readonly evidence?: string | null | undefined
}

/** The immediate answer of an enqueued action. */
export interface LeadActionQueued {
    /** The backend run id used by the progress query. */
    readonly id: string
    /** The run's initial status. */
    readonly status: "queued"
}

/** The identifiers and generated brief the frontend needs after a job finishes. */
export interface LeadActionResult {
    /** The customer captured or addressed. */
    readonly leadId?: string | null
    /** The owner and next step proposed. */
    readonly responsibilityId?: string | null
    /** The approval card produced by drafting. */
    readonly executionId?: string | null
    /** The authority-gated work, including a step waiting for a decision. */
    readonly workItemId?: string | null
    /** The regenerated context brief. */
    readonly contextSummary?: string | null
}

/** The progress and terminal result of an asynchronous action. */
export interface LeadActionStatus {
    /** The backend run id. */
    readonly id: string
    /** Where the run stands; succeeded means the action finished preparing, including work awaiting approval. */
    readonly status: "queued" | "running" | "succeeded" | "failed"
    /** The terminal result, absent until the work succeeds. */
    readonly result: LeadActionResult | null
    /** A stable error code, absent unless the run failed. */
    readonly errorCode: string | null
}

/** The optional accepted language header of a lead action request. */
export type LeadActionLanguage = string | undefined
