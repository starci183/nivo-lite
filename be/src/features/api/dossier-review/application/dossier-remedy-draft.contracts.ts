/** What the DossierRemedyDraft operation takes. */
export interface DossierRemedyDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The draft. */
    readonly draftId: string
}
