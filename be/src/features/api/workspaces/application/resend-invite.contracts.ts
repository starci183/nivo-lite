/** What resend invite takes. */
export interface ResendInviteRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The pending invitation. */
    readonly inviteId: string
}
