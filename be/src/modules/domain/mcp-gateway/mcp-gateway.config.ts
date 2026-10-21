import type { McpOptions } from "@modules/integrations/mcp"
import type { EnvSource } from "@modules/platform/config"
import type { McpGatewayOptions } from "./mcp-gateway.options"

/**
 * Reads the gateway settings around the MCP integration's options the app parsed (`parseMcpConfig`: the credential NAMES remote
 * connectors may reference, each mounted through `<NAME>_FILE`): the time limit of one call (`MCP_GATEWAY_TIMEOUT_MS`, 4 s).
 */
export const parseMcpGatewayConfig = (env: EnvSource, remote: McpOptions): McpGatewayOptions => ({
    remote,
    defaultTimeoutMs: env.int("MCP_GATEWAY_TIMEOUT_MS", 4000),
})
