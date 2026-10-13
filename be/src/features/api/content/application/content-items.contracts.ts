/** The optional schedule range for a content item list. */
export interface ContentItemsRange {
    /** Inclusive start, ISO 8601. */
    readonly from?: string
    /** Exclusive end, ISO 8601. */
    readonly to?: string
}

/** The workspace and schedule range selected for a content list. */
export interface ListContentItemsRequest {
    /** The workspace; the service verifies membership. */
    readonly workspaceId: string
    /** When present, only items scheduled in this range are returned. */
    readonly range?: ContentItemsRange
}
