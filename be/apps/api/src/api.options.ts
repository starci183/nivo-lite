import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { BillingOptions } from "@modules/domain/billing"
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
    /** The payment feeds: keys, bank account and the credential key. */
    readonly billing: BillingOptions
    /** How the pgmq workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
}
