/** What checkMeta takes. */
export interface CheckMetaRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** Make the subscriptions again first. */
    readonly repair: boolean
}
