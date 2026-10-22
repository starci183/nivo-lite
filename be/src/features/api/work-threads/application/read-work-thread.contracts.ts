/** What the ReadWorkThread operation takes. */
export interface ReadWorkThreadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The thread to read. */
    readonly threadId: string
}
