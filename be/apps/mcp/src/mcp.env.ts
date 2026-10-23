import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseMcpGatewayConfig } from "@modules/domain/mcp-gateway"
import { parseMcpConfig } from "@modules/integrations/mcp"
import { parseServerConfig } from "@modules/platform/config"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseQueueConfig } from "@modules/platform/queue"

/** Everything the mcp app needs: its port, its edge (origins, proxy hops, rate limits), the primary database and the gateway. */
export interface McpAppOptions {
    /** The HTTP port. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The browser-origin allowlist, the trusted proxy hops and the rate-limit tiers of the default-deny guards. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The primary database (connectors, grants, audit, bank credits). */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** The queue capability's tunables; the gateway app runs no worker, it uses the platform timer port only. */
    readonly queue: ReturnType<typeof parseQueueConfig>
    /** The connection key that opens the credential each remote connector has sealed in its row (CHANNEL_TOKEN_KEY). */
    readonly connectionSecrets: ReturnType<typeof parseConnectionSecretsConfig>
    /** The gateway settings (the per-call time limit). */
    readonly mcpGateway: ReturnType<typeof parseMcpGatewayConfig>
}

/** Reads the mcp app environment once. */
export const readMcpEnv = (env: EnvSource): McpAppOptions => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    queue: parseQueueConfig(env),
    connectionSecrets: parseConnectionSecretsConfig(env),
    mcpGateway: parseMcpGatewayConfig(env, parseMcpConfig(env)),
})
