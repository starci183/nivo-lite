/** What recheckZaloConnection takes. */
export interface RecheckZaloConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
