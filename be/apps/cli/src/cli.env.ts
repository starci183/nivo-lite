import { parseAiPoolConfig } from "@modules/integrations/ai-pool"
import { parseChannelProvisioningConfig } from "@modules/domain/channel-provisioning"
import { parseWorkspaceSeedConfig } from "@modules/domain/workspace-seed"
import { parseMcpGatewayConfig } from "@modules/domain/mcp-gateway"
import { parseMcpConfig } from "@modules/integrations/mcp"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import { parseOpenclawConfig } from "@modules/integrations/openclaw"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { EnvSource } from "@modules/platform/config"

/** Everything the lite cli needs: the Supabase PostgreSQL connection and the Supabase project it administers. */
export interface CliAppOptions {
    /** Private target-runner input for explicit account and membership operations. */
    readonly workspaceSeed: ReturnType<typeof parseWorkspaceSeedConfig>
    /** The gateway console a workspace profile registers its remote connectors through (its time limit). */
    readonly mcpGateway: ReturnType<typeof parseMcpGatewayConfig>
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<ReturnType<typeof parsePrimaryDatabaseConfig>>
    /** Where the shared n8n container runs, for `sync-n8n`. */
    readonly n8nHost: ReturnType<typeof parseN8nHostConfig>
    /** Supabase Auth administration, used by the demo-workspace seed. */
    readonly supabase: ReturnType<typeof parseSupabaseConfig>
    /** The AI pool the base knowledge is embedded with. */
    readonly aiPool: ReturnType<typeof parseAiPoolConfig>
    /** The credential key and the site addresses channels are connected with. */
    readonly channelConnections: ReturnType<typeof parseConnectionsConfig>
    /** The provider addresses the channel set-up calls. */
    readonly channelSetup: ReturnType<typeof parseChannelSetupConfig>
    /** The secrets and output of the connect-channel command. */
    readonly channelProvisioning: ReturnType<typeof parseChannelProvisioningConfig>
    /**
     * The OpenClaw settings the agent sync is composed with. Applying a setup only queues the sync of the agent (the api worker
     * writes it), so every key is optional here and the cli needs no OpenClaw credential.
     */
    readonly openclaw: ReturnType<typeof parseOpenclawConfig>
}

/**
 * Reads the cli environment once: the one declared connection without entities or TypeORM migrations, and the Supabase
 * project.
 */
export const readCliEnv = (env: EnvSource): CliAppOptions => ({
    workspaceSeed: parseWorkspaceSeedConfig(env),
    mcpGateway: parseMcpGatewayConfig(env, parseMcpConfig(env)),
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    supabase: parseSupabaseConfig(env),
    aiPool: parseAiPoolConfig(env),
    channelConnections: parseConnectionsConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    channelProvisioning: parseChannelProvisioningConfig(env, (line) => {
        process.stdout.write(`${line}\n`)
    }),
    openclaw: parseOpenclawConfig(env),
})
