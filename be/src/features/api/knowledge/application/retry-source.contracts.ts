/** What retry source takes. */
export interface RetrySourceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The document. */
    readonly sourceId: string
}
