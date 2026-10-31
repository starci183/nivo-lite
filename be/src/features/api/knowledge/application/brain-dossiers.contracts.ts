/** What the BrainDossiers operation takes. */
export interface BrainDossiersRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
