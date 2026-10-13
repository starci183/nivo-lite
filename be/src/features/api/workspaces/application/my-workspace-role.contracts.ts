/** What reading the caller's role in the active workspace takes. */
export interface MyWorkspaceRoleRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
