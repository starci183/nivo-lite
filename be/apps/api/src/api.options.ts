import { AgentsService } from "@modules/domain/agents"
import { KnowledgeSearchToolService } from "@modules/domain/agent-knowledge"
import { ApprovalRequesterService, ModuleApprovalGateService, ModulePerformersService } from "@modules/domain/decisions"
import { AutomationBusinessEventsService, AutomationPaymentReceiptsService } from "@modules/domain/automations"
import {
    BookingToolsService,
    ConversationLeadsService,
    HandoffToolService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { LeadReadService } from "@modules/domain/leads"
import { LeadFlowChainService } from "@modules/domain/lead-flows"
import { ToolTokenService } from "@modules/integrations/openclaw"
import { ModuleTextGeneratorService } from "@modules/domain/ai-generations"
import { ModuleOutboundMailService } from "@modules/domain/email-messages"
import type { ModuleOpsPorts } from "@modules/domain/module-ops"
import { BookingNotifierService } from "@modules/domain/booking-ports"
import type { DocumentsOptions } from "@modules/integrations/documents"
import type { LlmOptions } from "@modules/integrations/llm"
import type { ChannelSetupOptions } from "@modules/integrations/channel-setup"
import type { ConnectionsOptions } from "@modules/domain/connections"
import type { GoogleOptions } from "@modules/integrations/google"
import type { MetaOptions } from "@modules/integrations/meta"
import type { WebhookConnectionsOptions } from "@modules/domain/webhook-connections"
import type { WebhookDeliveryOptions } from "@modules/integrations/webhook-delivery"
import type { N8nOptions } from "@modules/integrations/n8n"
import type { DeepseekOptions } from "@modules/integrations/deepseek"
import type { OpenclawOptions } from "@modules/integrations/openclaw"
import type { VideoOptions } from "@modules/domain/video"
import type { SupabaseOptions } from "@modules/integrations/supabase"
import type { BillingOptions } from "@modules/domain/billing"
import type { FfmpegOptions } from "@modules/integrations/ffmpeg"
import type { TtsOptions } from "@modules/integrations/tts"
import type { ServerOptions } from "@modules/platform/config"
import type { DatabaseConnectionOptions } from "@modules/platform/database"
import type { ChannelsOptions } from "@modules/domain/channels"
import type { ConnectionSecretsOptions } from "@modules/domain/connection-secrets"
import type { LoyaltyOtpsOptions } from "@modules/domain/loyalty-otps"
import type { PlatformAdminOptions } from "@modules/domain/platform-admin"
import type { WorkspaceInvitesOptions } from "@modules/domain/workspace-invites"
import type { WorkspacesOptions } from "@modules/domain/workspaces"
import { DataSourcesError, DataSourcesErrorCode } from "@modules/integrations/data-sources"
import type { DataSourcesOptions } from "@modules/integrations/data-sources"
import type { TelegramUserErrors, TelegramUserOptions } from "@modules/integrations/telegram-user"
import type { MailOptions } from "@modules/integrations/mail"
import type { TelegramOptions } from "@modules/integrations/telegram"
import type { ZaloOptions } from "@modules/integrations/zalo"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import type { JobsConfig } from "@modules/platform/jobs"
import type { JobsAlertOptions } from "@modules/domain/job-ops"
import type { QueueConfig } from "@modules/platform/queue"

/** The existing data-sources error family used by the personal Telegram integration. */
export const TELEGRAM_USER_ERRORS: TelegramUserErrors = {
    rejected: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause }),
    unavailable: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail }, cause }),
    isError: (error): error is DataSourcesError => error instanceof DataSourcesError,
}

/** Everything the API needs from its environment, parsed once by `api.env.ts` and handed to `AppModule.register`. */
export interface ApiOptions {
    /** The HTTP listener. */
    readonly server: ServerOptions
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** The least-privilege PostgreSQL connection to the Supabase project. */
    readonly database: DatabaseConnectionOptions
    /** Supabase Auth, Storage and token-verification configuration. */
    readonly supabase: SupabaseOptions
    /** The embeddings and chat models, and the keys that reach them. */
    readonly llm: LlmOptions
    /** The Google Drive reader and the readers of office files and PDFs. */
    readonly documents: DocumentsOptions
    /** Whether a person with no workspace may create a free one. */
    readonly workspaces: WorkspacesOptions
    /** Invitation links and how long they stay valid. */
    readonly workspaceInvites: Omit<WorkspaceInvitesOptions, "delivery">
    /** The payment feeds: keys, bank account and the credential key. */
    readonly billing: BillingOptions
    /** The OpenClaw gateway and the agent workspaces. */
    readonly openclaw: OpenclawOptions
    /** The prompt library tunables. */
    readonly deepseek: DeepseekOptions
    /** The key that seals the credentials of the connections. */
    readonly connectionSecrets: ConnectionSecretsOptions
    /** The dedicated secret mixed into loyalty one-time code hashes. */
    readonly loyaltyOtps: LoyaltyOtpsOptions
    /** The public origin of the web app, for provider return addresses. */
    readonly channels: ChannelsOptions
    /** The Telegram Bot API host. */
    readonly telegram: TelegramOptions
    /** The Zalo OAuth and Open API hosts. */
    readonly zalo: ZaloOptions
    /** Outgoing mail: the platform sender and the private-host policy. */
    readonly mail: MailOptions
    /** The private-host policy for the owner's systems the data hub reads. */
    readonly dataSources: DataSourcesOptions
    /** The personal Telegram app used for account login and read-only chat sync. */
    readonly telegramUser: Omit<TelegramUserOptions, "errors">
    /** The platform team that may use the console. */
    readonly platformAdmin: PlatformAdminOptions
    /** How the pgmq workers run. */
    readonly queue: QueueConfig
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: JobsConfig
    /** The independent monitor of failed jobs and stale queued work. */
    readonly jobsAlert: JobsAlertOptions
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
    /** The signing secret and the webhook base of the shared n8n workflows. */
    readonly n8n: N8nOptions
    /** How ffmpeg is run. */
    readonly ffmpeg: FfmpegOptions
    /** The text-to-speech provider of the video voiceover. */
    readonly tts: TtsOptions
    /** Where the video renderer finds its assets and how it runs ffmpeg. */
    readonly video: VideoOptions
}

/** The ports the business modules (hiring, shifts, inventory) work through: the real gate, mailer and text generator. */
export const MODULE_OPS_PORTS: ModuleOpsPorts = {
    performers: ModulePerformersService,
    approvalGate: ModuleApprovalGateService,
    outboundMail: ModuleOutboundMailService,
    textGenerator: ModuleTextGeneratorService,
}

/** The delivery of booking notices through the customer's existing conversation and channel. */
export const BOOKING_PORTS = { notifier: BookingNotifierService }

/** The ports the agent-tools capability reaches the rest of the app through. */
export const AGENT_TOOLS_PORTS = {
    knowledgeSearch: KnowledgeSearchToolService,
    leadWriter: LeadWriterService,
    bookingTools: BookingToolsService,
    approvalRequester: ApprovalRequesterService,
    handoffTool: HandoffToolService,
    conversationLeads: ConversationLeadsService,
    toolTokens: ToolTokenService,
}

/** The ports the decisions capability reaches the rest of the app through. */
export const DECISIONS_PORTS = {
    agentDirectory: AgentsService,
    inboundEventStatus: InboundStatusService,
    decisionEvents: AutomationBusinessEventsService,
    paymentReceipts: AutomationPaymentReceiptsService,
    leadDirectory: LeadReadService,
    leadGenFlow: LeadFlowChainService,
    outboundAccessGate: OutboundAccessService,
}
