/** What moneyConnection takes. */
export interface GetMoneyConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
}
