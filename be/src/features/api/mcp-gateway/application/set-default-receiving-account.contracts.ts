/** What setDefaultReceivingAccount takes. */
export interface SetDefaultReceivingAccountRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The payment account that becomes the default. */
    readonly connectionId: string
}
