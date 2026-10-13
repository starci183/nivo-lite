/** What listing pending approvals takes. */
export interface ListPendingApprovalsRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
