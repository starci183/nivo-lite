/** Stable fields of an owner-review finding. */
export interface ContentAiReviewDetail {
    /** promise, figure, or length. */
    readonly kind: string
    /** The unsupported promise phrase. */
    readonly phrase: string | null
    /** The ungrounded numeric claim. */
    readonly figure: string | null
    /** The generated character count. */
    readonly length: number | null
    /** The recommended channel limit. */
    readonly max: number | null
}

/** A review finding attributed to the channel draft. */
export interface ContentAiReviewWarning {
    /** The channel to review. */
    readonly channel: string
    /** The normalized finding. */
    readonly warning: ContentAiReviewDetail
}

/** A request for drafting or rewriting an existing item. */
export interface ContentDraftRequest {
    /** The editable item. */
    readonly id: string
    /** Optional rewriting guidance. */
    readonly hint?: string
}

/** A topic to turn into a new channel draft. */
export interface ContentQuickDraftRequest {
    /** The pasted topic. */
    readonly topic: string
    /** The requested channels. */
    readonly channels: ReadonlyArray<string>
}

/** A job accepted by the content workbench. */
export interface ContentAiRequested {
    /** The workspace-scoped row identifier. */
    readonly id: string
    /** The durable operation state. */
    readonly status: string
    /** The related idea or draft, when one exists. */
    readonly itemId: string | null
}

/** A read-only view of queued, running, applied, or failed work. */
export interface ContentAiStatus {
    /** The workspace-scoped row identifier. */
    readonly id: string
    /** The durable operation state. */
    readonly status: string
    /** Percentage of completed generation work. */
    readonly progress: number
    /** The related idea or draft, when one exists. */
    readonly itemId: string | null
    /** The saved editorial plan. */
    readonly planId: string | null
    /** The saved result to open after completion. */
    readonly resultId: string | null
    /** The number of generated ideas. */
    readonly ideas: number | null
    /** Elapsed generation time in seconds. */
    readonly seconds: number | null
    /** Posting slots omitted because they were in the past. */
    readonly skippedPast: number | null
    /** Claim and length findings for owner review. */
    readonly warnings: ReadonlyArray<ContentAiReviewWarning>
    /** A stable terminal failure code. */
    readonly errorCode: string | null
}
