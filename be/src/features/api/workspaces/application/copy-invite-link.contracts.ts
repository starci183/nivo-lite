/** What copy invite link takes. */
export interface CopyInviteLinkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The pending invitation. */
    readonly inviteId: string
}
