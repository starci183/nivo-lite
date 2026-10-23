/** What the MCP integration needs: the client name it announces to remote servers. A remote server's bearer travels with its endpoint. */
export interface McpOptions {
    /** The client name announced in the MCP handshake (`MCP_CLIENT_NAME`, default `nivo-mcp-gateway`). */
    readonly clientName: string
}
