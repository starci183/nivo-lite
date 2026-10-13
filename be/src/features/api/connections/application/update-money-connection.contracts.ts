/** What updateMoneyConnection takes. */
export interface UpdateMoneyConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connection. */
    readonly connectionId: string
    /** Test or live. */
    readonly environment: string
    /** The name. */
    readonly name: string
    /** The bank code. */
    readonly bankCode: string
    /** A new account number; blank keeps the stored one. */
    readonly accountNumber: string
    /** The account holder. */
    readonly holder: string
    /** SePay: the API key. */
    readonly apiKey?: string | undefined
}
