/** What zaloConnectionPage takes. */
export interface GetZaloPageRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
