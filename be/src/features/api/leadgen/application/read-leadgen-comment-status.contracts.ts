/** The exact comment approval whose progress is requested. */
export interface ReadLeadGenCommentStatusRequest {
    /** The selected workspace; membership is proved before any read or write. */
    readonly workspaceId: string
    /** The public-comment work item whose decision is requested. */
    readonly workItemId: string
}
