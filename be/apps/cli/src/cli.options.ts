import type { LlmOptions } from "@modules/integrations/llm"
import type { ChannelProvisioningOptions } from "@modules/domain/channel-provisioning"
import type { ConnectionsOptions } from "@modules/domain/connections"
import type { ChannelSetupOptions } from "@modules/integrations/channel-setup"
import type { N8nHostOptions } from "@modules/integrations/n8n-host"
import type { SepaySimulationRegistration } from "@modules/domain/sepay-simulation"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { DatabaseConnectionOptions } from "@modules/platform/database"

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
    readonly sepaySimulation: SepaySimulationRegistration
    /** The credential key and the site addresses channels are connected with. */
    readonly channelConnections: ConnectionsOptions
    /** The provider addresses the channel set-up calls. */
    readonly channelSetup: ChannelSetupOptions
    /** The secrets and output of the connect-channel command. */
    readonly channelProvisioning: ChannelProvisioningOptions
}
