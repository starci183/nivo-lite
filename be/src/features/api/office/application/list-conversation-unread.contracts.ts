/** What listing the unread counts of the direct conversations takes. */
export interface ListConversationUnreadRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
}
