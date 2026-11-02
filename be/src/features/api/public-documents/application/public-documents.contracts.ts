/** What the PublicDocuments operation takes. */
export interface PublicDocumentsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
}
