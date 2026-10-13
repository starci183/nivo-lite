/** What remove member takes. */
export interface RemoveMemberRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The member to remove. */
    readonly userId: string
}
