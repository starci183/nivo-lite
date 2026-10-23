import type { McpOptions } from "@modules/integrations/mcp"
import type { EnvSource } from "@modules/platform/config"
import type { McpGatewayOptions } from "./mcp-gateway.options"

/**
 * Reads the gateway settings around the MCP integration's options the app parsed (`parseMcpConfig`): the time limit of one call
 * (`MCP_GATEWAY_TIMEOUT_MS`, 4 s). A remote connector's credential is not an environment setting: it is sealed per workspace in
 * the connector's row and set from the console.
 */
export const parseMcpGatewayConfig = (env: EnvSource, remote: McpOptions): McpGatewayOptions => ({
    remote,
    defaultTimeoutMs: env.int("MCP_GATEWAY_TIMEOUT_MS", 4000),
})
