/** What zaloConnectionEvents takes. */
export interface ListZaloEventsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
