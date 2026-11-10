/** What restore workspace takes. */
export interface RestoreWorkspaceRequest {
    /** The deleted workspace the caller names in X-Workspace-Id; the service proves they own it. */
    readonly workspaceId: string
}
