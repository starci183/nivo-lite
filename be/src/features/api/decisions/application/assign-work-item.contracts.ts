/** What assigning a work item takes. */
export interface AssignWorkItemRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The work item. */
    readonly workItemId: string
    /** The staff member, or null to take the item back. */
    readonly staffId: string | null | undefined
}
