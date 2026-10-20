import type { RemoteConnectorInput } from "@modules/domain/mcp-gateway"
/** What registerMcpConnector takes. */
export interface RegisterMcpConnectorRequest {
    /** The workspace the request is made in. */
    readonly workspaceId: string
    /** The connector. */
    readonly connector: RemoteConnectorInput
}
