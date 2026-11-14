/** What crmConnection takes. */
export interface LoadCrmConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The CRM connection to reopen. */
    readonly connectionId: string
}
