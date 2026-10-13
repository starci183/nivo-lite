/** Workspace-scoped transitionContentItem request. */
export interface TransitionContentItemRequest {
    /** The workspace whose membership and manager role the service verifies. */
    readonly workspaceId: string
    /** The post whose lifecycle changes. */
    readonly id: string
    /** The requested action: skip, restore, reopen or delete. */
    readonly kind: string
}

/** Identifies the post after its lifecycle operation has completed. */
export interface TransitionContentItemResult {
    /** The transitioned post id, retained after a delete as its acknowledgement. */
    readonly id: string
}
