/** Workspace-scoped moveContentItem request. */
export interface MoveContentItemRequest {
    /** The workspace whose membership and manager role the service verifies. */
    readonly workspaceId: string
    /** The post being moved on the calendar. */
    readonly id: string
    /** The new scheduled instant, ISO 8601. */
    readonly scheduledAt: string
}
