/** What list declined invites takes. */
export interface ListDeclinedInvitesRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
