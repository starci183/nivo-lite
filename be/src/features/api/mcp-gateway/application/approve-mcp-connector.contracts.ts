/** What approveMcpConnector takes. */
export interface ApproveMcpConnectorRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The remote connector whose live catalog is approved. */
    readonly key: string
}
