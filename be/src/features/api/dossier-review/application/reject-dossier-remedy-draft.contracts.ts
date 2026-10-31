/** What the RejectDossierRemedyDraft operation takes. */
export interface RejectDossierRemedyDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The draft. */
    readonly draftId: string
    /** Why, or null. */
    readonly reason: string | null
}
