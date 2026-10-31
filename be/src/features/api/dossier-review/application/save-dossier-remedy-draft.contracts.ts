/** What the SaveDossierRemedyDraft operation takes. */
export interface SaveDossierRemedyDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The draft. */
    readonly draftId: string
    /** The edited title. */
    readonly title: string
    /** The edited body. */
    readonly body: string
}
