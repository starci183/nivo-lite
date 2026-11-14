/** What connectionFields takes. */
export interface GetConnectionFieldsRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connected account. */
    readonly connectionId: string
}
