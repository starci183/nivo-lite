/** What scheduledItems takes: the workspace the caller names. */
export interface ReadScheduledItemsRequest {
    /** The workspace. */
    readonly workspaceId: string
}

/** What runScheduledItemNow takes: one item key from the list. */
export interface RunScheduledItemNowRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The item key, as the list gave it. */
    readonly id: string
}
