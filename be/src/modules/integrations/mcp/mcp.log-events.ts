/** Log events of the MCP integration. */
export enum McpLogEvent {
    /** Closing a remote session failed after its call ended; the call's own answer stands. */
    CloseFailed = "mcp.session.close-failed",
}
