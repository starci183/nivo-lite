import { parseLlmConfig } from "@modules/integrations/llm"
import { parseChannelProvisioningConfig } from "@modules/domain/channel-provisioning"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseN8nHostConfig } from "@modules/integrations/n8n-host"
import { parseSepaySimulationConfig } from "@modules/domain/sepay-simulation"
import { SimulationPostClient } from "@modules/integrations/webhook-delivery"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { EnvSource } from "@modules/platform/config"
import type { CliAppOptions } from "./cli.options"

/** Reads the cli environment once: the one declared connection without entities or TypeORM migrations, and the Supabase project. */
export const readCliEnv = (env: EnvSource): CliAppOptions => ({
    connections: [parsePrimaryDatabaseConfig(env)],
    n8nHost: parseN8nHostConfig(env),
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
    sepaySimulation: parseSepaySimulationConfig(env, SimulationPostClient, (line) => process.stdout.write(`${line}\n`)),
    channelConnections: parseConnectionsConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    channelProvisioning: parseChannelProvisioningConfig(env, (line) =>
        process.stdout.write(`${line}
`),
    ),
})
