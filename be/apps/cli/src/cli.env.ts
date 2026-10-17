import { parseLlmConfig } from "@modules/integrations/llm"
import { parseChannelProvisioningConfig } from "@modules/domain/channel-provisioning"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import { parseSepaySimulationConfig } from "@modules/domain/sepay-simulation"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { EnvSource } from "@modules/platform/config"

/** Everything the lite cli needs: the Supabase PostgreSQL connection and the Supabase project it administers. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<ReturnType<typeof parsePrimaryDatabaseConfig>>
    /** Where the shared n8n container runs, for `sync-n8n`. */
    readonly n8nHost: ReturnType<typeof parseN8nHostConfig>
    /** Supabase Auth administration, used by the demo-workspace seed. */
    readonly supabase: ReturnType<typeof parseSupabaseConfig>
    /** The model provider the base knowledge is embedded with. */
    readonly llm: ReturnType<typeof parseLlmConfig>
    /** The simulated SePay delivery of the simulate-sepay command. */
    readonly sepaySimulation: ReturnType<typeof parseSepaySimulationConfig>
    /** The credential key and the site addresses channels are connected with. */
    readonly channelConnections: ReturnType<typeof parseConnectionsConfig>
    /** The provider addresses the channel set-up calls. */
    readonly channelSetup: ReturnType<typeof parseChannelSetupConfig>
    /** The secrets and output of the connect-channel command. */
    readonly channelProvisioning: ReturnType<typeof parseChannelProvisioningConfig>
}

/**
 * Reads the cli environment once: the one declared connection without entities or TypeORM migrations, and the Supabase
 * project.
 */
export const readCliEnv = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
    sepaySimulation: parseSepaySimulationConfig(env),
    channelConnections: parseConnectionsConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    channelProvisioning: parseChannelProvisioningConfig(env, (line) => {
        process.stdout.write(`${line}\n`)
    }),
})
