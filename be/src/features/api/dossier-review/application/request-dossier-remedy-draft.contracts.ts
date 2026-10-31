/** What the RequestDossierRemedyDraft operation takes. */
export interface RequestDossierRemedyDraftRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The finding. */
    readonly findingId: string
    /** What the owner asks NIVO to take into account, or null. */
    readonly instructions: string | null
}
