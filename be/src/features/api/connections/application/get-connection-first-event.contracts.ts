/** What connectionFirstEvent takes. */
export interface GetConnectionFirstEventRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
