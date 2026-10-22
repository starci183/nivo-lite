/** What the ReadWorkChain operation takes. */
export interface ReadWorkChainRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The thread whose chain to read. */
    readonly threadId: string
}
