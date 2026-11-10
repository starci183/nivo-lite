/** What delete workspace takes. */
export interface DeleteWorkspaceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves they own it. */
    readonly workspaceId: string
    /** The workspace name the owner typed to confirm. */
    readonly confirmName: string
}
