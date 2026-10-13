/** What listing the pending notes of an installation takes. */
export interface ContextNotesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The installation. */
    readonly installationId: string
}
