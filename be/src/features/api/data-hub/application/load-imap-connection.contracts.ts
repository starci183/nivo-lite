/** What loadImapConnection takes. */
export interface LoadImapConnectionRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The mailbox connection. */
    readonly connectionId: string
}
