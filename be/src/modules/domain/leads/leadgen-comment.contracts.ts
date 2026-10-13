import type { Locale } from "@modules/platform/i18n"

/** A public-comment approval queued for the existing fenced decisions worker. */
export interface ApproveLeadGenCommentRequest {
    /** The selected workspace; membership is proved before any read or write. */
    readonly workspaceId: string
    /** The public-comment work item whose decision is requested. */
    readonly workItemId: string
    /** An optional edited reply; omission keeps the proposed draft. */
    readonly draft: LeadGenCommentDraft
    /** Language of the approval and recorded transcript lines. */
    readonly locale: Locale
}

/** The queued approval and its terminal result share the existing work-item identity. */
export interface LeadGenCommentStatus {
    /** Identity of the stored record. */
    readonly id: string
    /** Queued, running, succeeded or failed approval state. */
    readonly status: string
    /** Current state of the underlying work item. */
    readonly workStatus: string
    /** Where the completed reply can be inspected. */
    readonly resultHref: string | null
    /** Stable error code for a terminal failure. */
    readonly errorCode: string | null
}

/** Optional edited reply; omission and null preserve the existing proposal draft. */
export type LeadGenCommentDraft = string | null | undefined
