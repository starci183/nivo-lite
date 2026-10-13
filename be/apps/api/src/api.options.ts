import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { ServerOptions } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { ChannelsOptions } from "@modules/domain/channels"
import type { ConnectionSecretsOptions } from "@modules/domain/connection-secrets"
import type { WorkspaceInvitesOptions } from "@modules/domain/workspace-invites"
import type { WorkspacesOptions } from "@modules/domain/workspaces"
import type { MailOptions } from "@modules/integrations/mail"
import type { TelegramOptions } from "@modules/integrations/telegram"
import type { ZaloOptions } from "@modules/integrations/zalo"
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
    /** The key that seals the credentials of the connections. */
    readonly connectionSecrets: ConnectionSecretsOptions
    /** The public origin of the web app, for provider return addresses. */
    readonly channels: ChannelsOptions
    /** The Telegram Bot API host. */
    readonly telegram: TelegramOptions
    /** The Zalo OAuth and Open API hosts. */
    readonly zalo: ZaloOptions
    /** Outgoing mail: the platform sender and the private-host policy. */
    readonly mail: MailOptions
    /** How the pgmq workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
}
