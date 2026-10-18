/** What authorizeMeta takes. */
export interface AuthorizeMetaRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection to log in again, or nothing for a new one. */
    readonly connectionId?: string
}
