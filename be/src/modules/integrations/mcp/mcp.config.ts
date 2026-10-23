import type { EnvSource } from "@modules/platform/config"
import type { McpOptions } from "./mcp.options"

/** The client name NIVO announces to remote MCP servers unless the app names another. */
const DEFAULT_CLIENT_NAME = "nivo-mcp-gateway"

/**
 * Reads the MCP integration options: the client name announced to remote servers (`MCP_CLIENT_NAME`). No credential is read
 * here: a remote connector's bearer is sealed per workspace in its row and travels with its endpoint.
 */
export const parseMcpConfig = (env: EnvSource): McpOptions => ({
    clientName: env.optional("MCP_CLIENT_NAME") ?? DEFAULT_CLIENT_NAME,
})
