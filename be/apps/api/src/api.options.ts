import type { VideoOptions } from "@modules/domain/video"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { FfmpegOptions } from "@modules/integrations/ffmpeg"
import type { TtsOptions } from "@modules/integrations/tts"
import type { ServerOptions } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { PlatformAdminOptions } from "@modules/domain/platform-admin"
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
    /** The platform team that may use the console. */
    readonly platformAdmin: PlatformAdminOptions
    /** How the pgmq workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
    /** How ffmpeg is run. */
    readonly ffmpeg: FfmpegOptions
    /** The text-to-speech provider of the video voiceover. */
    readonly tts: TtsOptions
    /** Where the video renderer finds its assets and how it runs ffmpeg. */
    readonly video: VideoOptions
}
