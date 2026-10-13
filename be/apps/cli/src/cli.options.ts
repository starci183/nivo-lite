import { parseLlmConfig } from "@modules/integrations/llm"
import type { LlmOptions } from "@modules/integrations/llm"
import { parseChannelProvisioningConfig } from "@modules/domain/channel-provisioning"
import type { ChannelProvisioningOptions } from "@modules/domain/channel-provisioning"
import { parseConnectionsConfig } from "@modules/domain/connections"
import type { ConnectionsOptions } from "@modules/domain/connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import type { ChannelSetupOptions } from "@modules/integrations/channel-setup"
import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import type { N8nHostOptions } from "@modules/integrations/n8n-host"
import { parseSepaySimulationConfig } from "@modules/domain/sepay-simulation"
import type { SepaySimulationOptions } from "@modules/domain/sepay-simulation"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

/** How long the simulated delivery waits for the api. */
const SIMULATION_TIMEOUT_MS = 15_000

/** Everything the lite cli needs: the Supabase PostgreSQL connection and the Supabase project it administers. */
export interface CliAppOptions {
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<DatabaseConnectionOptions>
    /** Where the shared n8n container runs, for `sync-n8n`. */
    readonly n8nHost: N8nHostOptions
    /** Supabase Auth administration, used by the demo-workspace seed. */
    readonly supabase: SupabaseOptions
    /** The model provider the base knowledge is embedded with. */
    readonly llm: LlmOptions
    /** The simulated SePay delivery of the simulate-sepay command. */
    readonly sepaySimulation: SepaySimulationOptions
    /** The credential key and the site addresses channels are connected with. */
    readonly channelConnections: ConnectionsOptions
    /** The provider addresses the channel set-up calls. */
    readonly channelSetup: ChannelSetupOptions
    /** The secrets and output of the connect-channel command. */
    readonly channelProvisioning: ChannelProvisioningOptions
}

/** Reads the one declared connection without adding entities or TypeORM migrations, and the Supabase project. */
export const parseCliAppOptions = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
    sepaySimulation: parseSepaySimulationConfig(
        env,
        async ({ url, headers, body }) => {
            const reply = await fetch(url, {
                method: "POST",
                headers: { ...headers },
                body,
                signal: AbortSignal.timeout(SIMULATION_TIMEOUT_MS),
            })
            return { status: reply.status, text: await reply.text() }
        },
        (line) => process.stdout.write(`${line}\n`),
    ),
    channelConnections: parseConnectionsConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    channelProvisioning: parseChannelProvisioningConfig(env, (line) =>
        process.stdout.write(`${line}
`),
    ),
})
