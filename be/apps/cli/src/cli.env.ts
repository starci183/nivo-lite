import { parseAiConfig } from "@modules/integrations/ai"
import { parseEntityEngineConfig } from "@modules/domain/entity-engine"
import { parseChannelProvisioningConfig } from "@modules/domain/channel-provisioning"
import { parseWorkspaceSeedConfig } from "@modules/domain/workspace-seed"
import { parseToolsConfig } from "@modules/domain/tools"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseObjectStorageConfig } from "@modules/integrations/object-storage"
import { parseIdentityAuthConfig } from "@modules/domain/identity"
import { parseMailConfig } from "@modules/integrations/mail"
import { parsePassportConfig } from "@modules/integrations/passport"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { EnvSource } from "@modules/platform/config"

/** Everything the lite cli needs: the PostgreSQL connection and the own-auth account administration. */
export interface CliAppOptions {
    /** Private target-runner input for explicit account and membership operations. */
    readonly workspaceSeed: ReturnType<typeof parseWorkspaceSeedConfig>
    /** The engine tools settings of the console (the per-call time limit). */
    readonly toolsConfig: ReturnType<typeof parseToolsConfig>
    /** The connections the built-in migrate and seed groups operate on. */
    readonly connections: ReadonlyArray<ReturnType<typeof parsePrimaryDatabaseConfig>>
    /** Our own access-token keys: the accounts the demo-workspace seed proves a password or a token against. */
    readonly passport: ReturnType<typeof parsePassportConfig>
    /** The web origin and lifetimes of sign-in, behind the account administration. */
    readonly identityAuth: ReturnType<typeof parseIdentityAuthConfig>
    /** The platform mail sender the account administration needs to be composed. */
    readonly mail: ReturnType<typeof parseMailConfig>
    /** The S3 object store (MinIO) the cli writes files and the storage commands migrate into. */
    readonly storage: ReturnType<typeof parseObjectStorageConfig>
    /** The LangChain client the base knowledge is embedded with, through the gateway of the API (`AI_BASE_URL`). */
    readonly ai: ReturnType<typeof parseAiConfig>
    /** The credential key and the site addresses channels are connected with; the ports are bound by `compose/modules.ts`. */
    readonly channelConnections: ReturnType<typeof parseConnectionsConfig>
    /** The provider addresses the channel set-up calls. */
    readonly channelSetup: ReturnType<typeof parseChannelSetupConfig>
    /** The secrets and output of the connect-channel command. */
    readonly channelProvisioning: ReturnType<typeof parseChannelProvisioningConfig>
    /** The key that signs the cursors of the entity engine, which holds the graph of each agent. */
    readonly entityEngine: ReturnType<typeof parseEntityEngineConfig>
}

/**
 * Reads the cli environment once: the one declared connection without entities or TypeORM migrations, and the own-auth
 * settings of the account administration.
 */
export const readCliEnv = (env: EnvSource): CliAppOptions => ({
    workspaceSeed: parseWorkspaceSeedConfig(env),
    toolsConfig: parseToolsConfig(env),
    connections: [parsePrimaryDatabaseConfig(env)],
    passport: parsePassportConfig(env),
    identityAuth: parseIdentityAuthConfig(env),
    mail: parseMailConfig(env),
    storage: parseObjectStorageConfig(env),
    ai: parseAiConfig(env),
    channelConnections: parseConnectionsConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    channelProvisioning: parseChannelProvisioningConfig(env, (line) => {
        process.stdout.write(`${line}\n`)
    }),
    entityEngine: parseEntityEngineConfig(env),
})
