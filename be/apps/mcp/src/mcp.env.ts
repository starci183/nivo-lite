import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseEntityEngineConfig } from "@modules/domain/entity-engine"
import { parseAiConfig } from "@modules/integrations/ai"
import { parseQdrantConfig } from "@modules/integrations/qdrant"
import { parseObjectStorageConfig } from "@modules/integrations/object-storage"
import { parseBillingConfig } from "@modules/domain/billing"
import { parseServerConfig, type EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseRealtimeConfig } from "@modules/platform/realtime"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
import { parseAgentRunsConfig } from "@modules/domain/agent-runs"
import { parseRedisConfig } from "@modules/integrations/redis"

/**
 * Everything the mcp app needs: its port, its edge (origins, proxy hops, rate limits), the primary database, and what the ops' handlers
 * read (no provider, no tool, no graph engine).
 */
export interface McpAppOptions {
    /** The HTTP port. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The browser-origin allowlist, the trusted proxy hops and the rate-limit tiers of the default-deny guards. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The primary database (connectors, grants, audit, bank credits). */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** The queue capability's tunables; the app runs no worker and no relay: the outbox rows it writes are the api's to relay. */
    readonly queue: ReturnType<typeof parseQueueConfig>
    /** The connection key that opens the credential each remote connector has sealed in its row (CHANNEL_TOKEN_KEY). */
    readonly connectionSecrets: ReturnType<typeof parseConnectionSecretsConfig>
    /** The key that signs entity-engine cursors. */
    readonly entityEngine: ReturnType<typeof parseEntityEngineConfig>
    /** The AI endpoint (the readiness probe's and the setup chat's generation client); every key is optional. */
    readonly ai: ReturnType<typeof parseAiConfig>
    /** The vector index (`QDRANT_URL` required, `QDRANT_API_KEY`): a required engine piece of every process that reads truths. */
    readonly qdrant: ReturnType<typeof parseQdrantConfig>
    /** The object store the file ops keep a record's files in. */
    readonly storage: ReturnType<typeof parseObjectStorageConfig>
    /** The plan limits a file upload is checked against (the storage room of the workspace's plan). */
    readonly billing: ReturnType<typeof parseBillingConfig>
    /** The realtime hub the api runs (Redis while Redis is declared, else Postgres): what this process publishes reaches the api's clients. */
    readonly realtime: ReturnType<typeof parseRealtimeConfig>
    /** The channel token key that seals provider credentials and the site address (the api's `connections`, the same variables). */
    readonly connections: ReturnType<typeof parseConnectionsConfig>
    /** Whether a person with no workspace may create a free one (the workspaces capability billing reads). */
    readonly workspaces: ReturnType<typeof parseWorkspacesConfig>
    /** The Redis connections the capabilities that keep state in Redis open. */
    readonly redis: ReturnType<typeof parseRedisConfig>
    /** How many agent runs run at once. */
    readonly agentRuns: ReturnType<typeof parseAgentRunsConfig>
}

/** Reads the mcp app environment once. */
export const readMcpEnv = (env: EnvSource): McpAppOptions => ({
    server: parseServerConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    database: parsePrimaryDatabaseConfig(env),
    queue: parseQueueConfig(env),
    connectionSecrets: parseConnectionSecretsConfig(env),
    entityEngine: parseEntityEngineConfig(env),
    ai: parseAiConfig(env),
    qdrant: parseQdrantConfig(env),
    storage: parseObjectStorageConfig(env),
    billing: parseBillingConfig(env),
    realtime: parseRealtimeConfig(env),
    connections: parseConnectionsConfig(env),
    workspaces: parseWorkspacesConfig(env),
    redis: parseRedisConfig(env),
    agentRuns: parseAgentRunsConfig(env),
})
