/** What the DossierReviewSummary operation takes. */
export interface DossierReviewSummaryRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
