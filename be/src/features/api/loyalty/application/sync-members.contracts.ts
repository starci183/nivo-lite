/** What sync-members takes. */
export interface SyncMembersRequest {
    /** The workspace id. */
    readonly workspaceId: string
}

/** What sync-members answers. */
export interface SyncMembersResult {
    /** The created. */
    readonly created: number
    /** The linked. */
    readonly linked: number
}
