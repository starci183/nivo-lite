import type { Locale } from "@modules/platform/i18n"

/** The workspace and draft selected for human approval. */
export interface SubmitContentRequest {
    /** The selected workspace; membership is proved by the service. */
    readonly workspaceId: string
    /** The draft to approve. */
    readonly id: string
    /** The language of history and approval copy. */
    readonly locale: Locale
}

/** The existing work item through which a person approves the post. */
export interface SubmittedContent {
    /** The content item. */
    readonly id: string
    /** The gate work item to decide. */
    readonly workItemId: string
    /** The gate's current status. */
    readonly status: string
}

/** A member's proof of manually publishing one approved channel. */
export interface MarkContentPublishedRequest extends SubmitContentRequest {
    /** The channel the member posted to. */
    readonly channel: string
    /** The external post URL, or empty when proof is a note. */
    readonly url: string
    /** The note of how the post was published. */
    readonly how: string
}
