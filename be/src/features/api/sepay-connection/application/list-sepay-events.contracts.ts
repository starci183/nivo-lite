/** What sepayConnectionEvents takes. */
export interface ListSepayEventsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
