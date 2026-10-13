import type { ChannelSetupOptions } from "@modules/integrations/channel-setup"
import type { ConnectionsOptions } from "@modules/domain/connections"
import type { GoogleOptions } from "@modules/integrations/google"
import type { MetaOptions } from "@modules/integrations/meta"
import type { WebhookConnectionsOptions } from "@modules/domain/webhook-connections"
import type { WebhookDeliveryOptions } from "@modules/integrations/webhook-delivery"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { ServerOptions } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { WorkspaceInvitesOptions } from "@modules/domain/workspace-invites"
import type { WorkspacesOptions } from "@modules/domain/workspaces"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobsConfig } from "@modules/platform/jobs"
import type { QueueConfig } from "@modules/platform/queue"

/** Everything the API needs from its environment, parsed once by `main.ts` and handed to `AppModule.register`. */
export interface ApiOptions {
    /** The HTTP listener. */
    readonly server: ServerOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** The least-privilege PostgreSQL connection to the Supabase project. */
    readonly database: DatabaseConnectionOptions
    /** Supabase Auth, Storage and token-verification configuration. */
    readonly supabase: SupabaseOptions
    /** Whether a person with no workspace may create a free one. */
    readonly workspaces: WorkspacesOptions
    /** Invitation links and how long they stay valid. */
    readonly workspaceInvites: Omit<WorkspaceInvitesOptions, "delivery">
    /** How the pgmq workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
    /** The channel token key that seals provider credentials, and the public site address. */
    readonly connections: ConnectionsOptions
    /** The signing key behind outgoing webhooks. */
    readonly webhookConnections: WebhookConnectionsOptions
    /** Google OAuth and Sheets. */
    readonly google: GoogleOptions
    /** Meta (Facebook Pages and Instagram). */
    readonly meta: MetaOptions
    /** The provider calls a connection wizard makes while connecting a channel. */
    readonly channelSetup: ChannelSetupOptions
    /** Deliveries to tenant-supplied webhook addresses. */
    readonly webhookDelivery: WebhookDeliveryOptions
}
