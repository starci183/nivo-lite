/** What authorizeZalo takes. */
export interface AuthorizeZaloRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
