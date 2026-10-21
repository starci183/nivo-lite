/** Log events of the MCP gateway. */
export enum McpGatewayLogEvent {
    /** A connector call failed or timed out; the caller got `unavailable`. */
    CallFailed = "mcp-gateway.call.failed",
    /** Reading a remote connector's tool catalog failed; the connector is marked degraded and keeps its last catalog. */
    SyncFailed = "mcp-gateway.catalog.sync-failed",
    /** An owner or manager approved the live tool catalog of a remote connector. */
    CatalogApproved = "mcp-gateway.catalog.approved",
    /** A health check of a connector got no answer; the connector is marked degraded. */
    HealthFailed = "mcp-gateway.health.failed",
}
