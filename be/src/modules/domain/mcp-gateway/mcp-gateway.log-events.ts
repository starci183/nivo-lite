/** Log events of the MCP gateway. */
export enum McpGatewayLogEvent {
    /** A connector call failed or timed out; the caller got `unavailable`. */
    CallFailed = "mcp-gateway.call.failed",
}
