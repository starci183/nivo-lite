/** What delete source takes. */
export interface DeleteSourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
}
