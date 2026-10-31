/** What the ApproveDossierRemedyDraft operation takes. */
export interface ApproveDossierRemedyDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The draft. */
    readonly draftId: string
}
