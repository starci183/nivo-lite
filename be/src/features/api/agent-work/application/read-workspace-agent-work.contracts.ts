/** What the workspace-wide work switch with the counts beside it takes. */
export interface ReadWorkspaceAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their role. */
    readonly workspaceId: string
}
