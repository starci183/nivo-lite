/** What the RequestDossierReview operation takes. */
export interface RequestDossierReviewRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The dossier, or null for the whole set. */
    readonly dossierId: string | null
}
