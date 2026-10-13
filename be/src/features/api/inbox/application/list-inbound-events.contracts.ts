/** The bounded feed selected in the active workspace. */
export interface ListInboundEventsRequest {
    /** The workspace selected by the transport. */
    readonly workspaceId: string
    /** Maximum number of recent inputs to return. */
    readonly limit: number
}
