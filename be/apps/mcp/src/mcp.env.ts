import { parseMcpGatewayConfig } from "@modules/domain/mcp-gateway"
import { parseServerConfig } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"

/** Everything the mcp app needs: its port, the primary database and the gateway (credential names, agent token, limits). */
export interface McpAppOptions {
    /** The HTTP port. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The primary database (connectors, grants, audit). */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** The gateway settings; every secret is read through <NAME>_FILE. */
    readonly mcpGateway: ReturnType<typeof parseMcpGatewayConfig>
}

/** Reads the mcp app environment once. */
export const readMcpEnv = (env: EnvSource): McpAppOptions => ({
    server: parseServerConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    mcpGateway: parseMcpGatewayConfig(env),
})
