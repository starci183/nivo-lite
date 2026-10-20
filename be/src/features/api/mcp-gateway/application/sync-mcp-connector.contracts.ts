/** What syncMcpConnector takes. */
export interface SyncMcpConnectorRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connector key. */
    readonly key: string
}
