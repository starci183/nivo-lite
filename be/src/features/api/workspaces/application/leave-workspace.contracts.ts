/** What leave workspace takes. */
export interface LeaveWorkspaceRequest {
    /** The workspace the caller names in X-Workspace-Id; the service finds their seat in it. */
    readonly workspaceId: string
}
