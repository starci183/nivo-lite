/** What holding a work item takes. */
export interface HoldWorkItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
    /** Why it should keep waiting. */
    readonly note: string
}
