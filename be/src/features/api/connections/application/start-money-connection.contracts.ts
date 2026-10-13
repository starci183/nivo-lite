/** What startMoneyConnection takes. */
export interface StartMoneyConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** Which feed: sepay, payos or casso. */
    readonly provider: string
    /** Test or live. */
    readonly environment: string
    /** The name. */
    readonly name: string
    /** The bank code (bank feeds). */
    readonly bankCode: string
    /** The account number (bank feeds). */
    readonly accountNumber: string
    /** The account holder (bank feeds). */
    readonly holder: string
}
