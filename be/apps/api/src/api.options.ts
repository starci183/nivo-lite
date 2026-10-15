import { AGENTS_SYNC_SCHEDULER } from "@modules/queues/agents"
import { AUTOMATION_TICK_SCHEDULER } from "@modules/queues/automation"
import { SHIFTS_TICK_SCHEDULER } from "@modules/queues/shifts"
import { DECISIONS_DRAIN_SCHEDULER } from "@modules/queues/decisions"
import { CONNECTION_HEALTH_SCHEDULER } from "@modules/queues/connection-health"
import { CONTENT_TICK_EVERY_MS, CONTENT_TICK_QUEUE, CONTENT_TICK_SCHEDULER } from "@modules/queues/content-tick"
import { DATA_SYNC_SCHEDULER } from "@modules/queues/data-sync"
import { ZALO_REFRESH_SCHEDULER } from "@modules/queues/zalo-refresh"
import type { QueueSchedulerDefinition } from "@modules/platform/queue"
import { RunDataSyncQueueModule } from "@features/jobs/run-data-sync"
import { ExtractKnowledgeFactsQueueModule } from "@features/jobs/extract-knowledge-facts"
import { RunBrainCommandQueueModule } from "@features/jobs/run-brain-command"
import { IndexKnowledgeSourceQueueModule } from "@features/jobs/index-knowledge-source"
import { ReembedKnowledgeQueueModule } from "@features/jobs/reembed-knowledge"
import { EmitN8nEventQueueModule } from "@features/jobs/emit-n8n-event"
import { EmitWebhookEventQueueModule } from "@features/jobs/emit-webhook-event"
import { RunAutomationCommandQueueModule } from "@features/jobs/run-automation-command"
import { RunAutomationTickQueueModule } from "@features/jobs/run-automation-tick"
import { RunDecisionsQueueModule } from "@features/jobs/run-decisions"
import { RunSetupTurnQueueModule } from "@features/jobs/run-setup-turn"
import { GenerateWithAgentQueueModule } from "@features/jobs/generate-with-agent"
import { SyncAgentsQueueModule } from "@features/jobs/sync-agents"
import { DrainWorkQueueModule } from "@features/jobs/drain-work"
import { DraftLoyaltyCampaignQueueModule } from "@features/jobs/draft-loyalty-campaign"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunZaloWizardQueueModule } from "@features/jobs/run-zalo-wizard"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { RunLeadActionQueueModule } from "@features/jobs/run-lead-action"
import { ReconcileBankCreditQueueModule } from "@features/jobs/reconcile-bank-credit"
import { CreatePaymentOrderQueueModule } from "@features/jobs/create-payment-order"
import { ApplyBookingStatusQueueModule } from "@features/jobs/apply-booking-status"
import { PublishContentQueueModule } from "@features/jobs/publish-content"
import { AcceptMetaEventQueueModule } from "@features/jobs/accept-meta-event"
import { IssueInviteQueueModule } from "@features/jobs/issue-invite"
import { RenderVideoQueueModule } from "@features/jobs/render-video"
import { ConnectionCommandsQueueModule } from "@features/jobs/connection-commands"
import { RequestRenderQueueModule } from "@features/jobs/request-render"
import { DeductOrderQueueModule } from "@features/jobs/deduct-order"
import { ReplenishStockQueueModule } from "@features/jobs/replenish-stock"
import { HiringTickQueueModule } from "@features/jobs/hiring-tick"
import { RunShiftsAlertsQueueModule } from "@features/jobs/run-shifts-alerts"
import { AgentsService } from "@modules/domain/agents"
import {
    AgentKnowledgeLensService,
    KnowledgeSearchToolService,
    ModuleProfilesService,
} from "@modules/domain/agent-knowledge"
import { CustomerOutcomesService, CustomerTurnRuntimeService } from "@modules/domain/customer-turns"
import { InstallationDirectoryService } from "@modules/domain/modules"
import {
    ApprovalRequesterService,
    DECISIONS_ERROR_KINDS,
    DECISIONS_MESSAGES,
    DecisionCorrectionsService,
    ModuleApprovalGateService,
    ModulePerformersService,
} from "@modules/domain/decisions"
import {
    AUTOMATIONS_ERROR_KINDS,
    AUTOMATIONS_MESSAGES,
    AutomationBusinessEventsService,
    AutomationPaymentReceiptsService,
} from "@modules/domain/automations"
import {
    BookingToolsService,
    ConversationLeadsService,
    HandoffToolService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { RunLeadGenQueueModule } from "@features/jobs/run-lead-gen"
import { LEADS_ERROR_KINDS, LEADS_MESSAGES, LeadReadService, LeadsModule } from "@modules/domain/leads"
import {
    LEAD_FLOWS_ERROR_KINDS,
    LEAD_FLOWS_MESSAGES,
    LeadFlowChainService,
    LeadFlowsModule,
    LeadGenIntakeService,
} from "@modules/domain/lead-flows"
import { ToolTokenService } from "@modules/integrations/openclaw"
import { ModuleTextGeneratorService } from "@modules/domain/ai-generations"
import { ModuleOutboundMailService } from "@modules/domain/email-messages"
import { MODULE_OPS_ERROR_KINDS, MODULE_OPS_MESSAGES } from "@modules/domain/module-ops"
import type { ModuleOpsPorts } from "@modules/domain/module-ops"
import { AUTOMATION_PORTS_MESSAGES } from "@modules/domain/automation-ports"
import { BOOKING_PORTS_MESSAGES, BookingNotifierService } from "@modules/domain/booking-ports"
import { FLOW_ENGINE_ERROR_KINDS, FLOW_ENGINE_MESSAGES } from "@modules/domain/flow-engine"
import { DriveGrantService } from "@modules/domain/google-connections"
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
import { AppCommandsModule } from "@modules/domain/app-commands"
import { CONTRACTS_ERROR_KINDS, CONTRACTS_MESSAGES, ContractsModule } from "@modules/domain/contracts"
import { LIVENESS_ERROR_KINDS, LIVENESS_MESSAGES, LivenessModule } from "@modules/domain/liveness"

/** The existing data-sources error family used by the personal Telegram integration. */
export const TELEGRAM_USER_ERRORS: TelegramUserErrors = {
    rejected: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Rejected, params: { detail }, cause }),
    unavailable: (detail, cause) =>
        new DataSourcesError({ code: DataSourcesErrorCode.Unavailable, params: { detail }, cause }),
    isError: (error): error is DataSourcesError => error instanceof DataSourcesError,
}

/** System capabilities whose only app option is their global registration. */
export const API_SYSTEM_CAPABILITIES = [AppCommandsModule, ContractsModule, LivenessModule]

/** Message bundles and error kinds of the system capabilities above. */
export const API_SYSTEM = {
    messages: [CONTRACTS_MESSAGES, LIVENESS_MESSAGES],
    kinds: [CONTRACTS_ERROR_KINDS, LIVENESS_ERROR_KINDS],
} as const

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

/**
 * The ports G19 plugs in: the installations, knowledge lens and module profiles the agents capability reads, the AI step and
 * outcome handler of every customer chat turn, and the connection points of the automations, business modules and decisions.
 */
export const G19_PORTS = {
    agents: {
        installations: InstallationDirectoryService,
        knowledge: AgentKnowledgeLensService,
        modules: ModuleProfilesService,
    },
    chatTurn: { runtime: CustomerTurnRuntimeService, outcomes: CustomerOutcomesService },
    /** The decisions source the brain studies for corrections. */
    brain: { corrections: DecisionCorrectionsService },
    bookings: BOOKING_PORTS,
    /** The message bundles of automations, decisions, module-ops, automation ports, booking ports and flow engine. */
    messages: [
        AUTOMATIONS_MESSAGES,
        DECISIONS_MESSAGES,
        MODULE_OPS_MESSAGES,
        AUTOMATION_PORTS_MESSAGES,
        BOOKING_PORTS_MESSAGES,
        FLOW_ENGINE_MESSAGES,
    ],
    /** Their error kind tables. */
    errorKinds: [AUTOMATIONS_ERROR_KINDS, DECISIONS_ERROR_KINDS, MODULE_OPS_ERROR_KINDS, FLOW_ENGINE_ERROR_KINDS],
    /** The ports of the business modules (hiring, shifts, inventory): the real gate, mailer and text generator. */
    moduleOps: MODULE_OPS_PORTS,
    /** The provider of the Google Drive access of a workspace, for the knowledge capability. */
    driveAccess: DriveGrantService,
}

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

/** The background jobs the api runs: each queue module registers its processor with the job runner. */
export const API_JOB_QUEUES = [
    RunDataSyncQueueModule,
    ExtractKnowledgeFactsQueueModule,
    RunBrainCommandQueueModule,
    IndexKnowledgeSourceQueueModule,
    ReembedKnowledgeQueueModule,
    EmitN8nEventQueueModule,
    EmitWebhookEventQueueModule,
    RunAutomationCommandQueueModule,
    RunAutomationTickQueueModule,
    RunDecisionsQueueModule,
    RunSetupTurnQueueModule,
    GenerateWithAgentQueueModule,
    SyncAgentsQueueModule,
    DrainWorkQueueModule,
    DraftLoyaltyCampaignQueueModule,
    CheckConnectionHealthQueueModule,
    CompleteZaloAuthorizationQueueModule,
    RefreshZaloTokensQueueModule,
    RunZaloWizardQueueModule,
    RunChatTurnQueueModule,
    RunLeadActionQueueModule,
    ReconcileBankCreditQueueModule,
    CreatePaymentOrderQueueModule,
    ApplyBookingStatusQueueModule,
    PublishContentQueueModule,
    AcceptMetaEventQueueModule,
    RunLeadGenQueueModule,
    IssueInviteQueueModule,
    RenderVideoQueueModule,
    ConnectionCommandsQueueModule,
    RequestRenderQueueModule,
    DeductOrderQueueModule,
    ReplenishStockQueueModule,
    HiringTickQueueModule,
    RunShiftsAlertsQueueModule,
]

/** The recurring ticks the api schedules on the queue. */
export const API_SCHEDULERS: ReadonlyArray<QueueSchedulerDefinition> = [
    AUTOMATION_TICK_SCHEDULER,
    SHIFTS_TICK_SCHEDULER,
    AGENTS_SYNC_SCHEDULER,
    DECISIONS_DRAIN_SCHEDULER,
    { queue: CONTENT_TICK_QUEUE, id: CONTENT_TICK_SCHEDULER, everyMs: CONTENT_TICK_EVERY_MS },
    CONNECTION_HEALTH_SCHEDULER,
    ZALO_REFRESH_SCHEDULER,
    DATA_SYNC_SCHEDULER,
]

/** The leads and the lead generation flow: their texts and error kinds, and the two capabilities the app root registers globally. */
export const LEAD_LANE = {
    messages: [LEADS_MESSAGES, LEAD_FLOWS_MESSAGES],
    kinds: [LEADS_ERROR_KINDS, LEAD_FLOWS_ERROR_KINDS],
    capabilities: [LeadsModule, LeadFlowsModule],
    metaTaker: LeadGenIntakeService,
}
