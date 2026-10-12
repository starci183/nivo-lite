/** What revoke invite takes. */
export interface RevokeInviteRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The pending invitation. */
    readonly inviteId: string
}
