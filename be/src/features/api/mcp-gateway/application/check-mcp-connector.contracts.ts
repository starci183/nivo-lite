/** What checkMcpConnector takes. */
export interface CheckMcpConnectorRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The remote connector to check. */
    readonly key: string
}
