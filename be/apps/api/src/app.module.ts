import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AutomationsHttpModule } from "@features/api/automations"
import { FlowsHttpModule } from "@features/api/flows"
import { N8nPipelinesHttpModule } from "@features/api/n8n-pipelines"
import { EmitN8nEventQueueModule } from "@features/jobs/emit-n8n-event"
import { RunAutomationCommandQueueModule } from "@features/jobs/run-automation-command"
import { RunAutomationTickQueueModule } from "@features/jobs/run-automation-tick"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsHttpModule } from "@features/api/agents"
import { DecisionsHttpModule } from "@features/api/decisions"
import { RunDecisionsQueueModule } from "@features/jobs/run-decisions"
import { GenerateWithAgentQueueModule } from "@features/jobs/generate-with-agent"
import { SyncAgentsQueueModule } from "@features/jobs/sync-agents"
import { BookingHttpModule } from "@features/api/booking"
import { LoyaltyHttpModule } from "@features/api/loyalty"
import { LoyaltyTillHttpModule } from "@features/api/loyalty-till"
import { PublicBookingHttpModule } from "@features/api/public-booking"
import { PublicLoyaltyHttpModule } from "@features/api/public-loyalty"
import { CheckConnectionHealthQueueModule } from "@features/jobs/check-connection-health"
import { CompleteZaloAuthorizationQueueModule } from "@features/jobs/complete-zalo-authorization"
import { RefreshZaloTokensQueueModule } from "@features/jobs/refresh-zalo-tokens"
import { RunChatTurnQueueModule } from "@features/jobs/run-chat-turn"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { LeadsHttpModule } from "@features/api/leads"
import { AdminHttpModule } from "@features/api/admin"
import { ModulesHttpModule } from "@features/api/modules"
import { OfficeHttpModule } from "@features/api/office"
import { ExternalApiHttpModule } from "@features/api/external-api"
import { SystemHealthHttpModule } from "@features/api/system-health"
import { BOOKINGS_ERROR_KINDS, BOOKINGS_MESSAGES, BookingsModule } from "@modules/domain/bookings"
import {
    LOYALTY_CAMPAIGNS_ERROR_KINDS,
    LOYALTY_CAMPAIGNS_MESSAGES,
    LoyaltyCampaignsModule,
} from "@modules/domain/loyalty-campaigns"
import { LoyaltyCustomerLinksModule } from "@modules/domain/loyalty-customer-links"
import { LoyaltyCustomersModule } from "@modules/domain/loyalty-customers"
import {
    LOYALTY_LEDGER_ERROR_KINDS,
    LOYALTY_LEDGER_MESSAGES,
    LoyaltyLedgerModule,
} from "@modules/domain/loyalty-ledger"
import { LOYALTY_OTPS_ERROR_KINDS, LOYALTY_OTPS_MESSAGES, LoyaltyOtpsModule } from "@modules/domain/loyalty-otps"
import { LoyaltyProgramsModule } from "@modules/domain/loyalty-programs"
import { LoyaltyRewardsModule } from "@modules/domain/loyalty-rewards"
import { LOYALTY_ERROR_KINDS, LOYALTY_MESSAGES, LoyaltyModule } from "@modules/domain/loyalty"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { CassoHttpModule } from "@features/webhooks/casso"
import { PayosHttpModule } from "@features/webhooks/payos"
import { SepayHttpModule } from "@features/webhooks/sepay"
import { VietcombankHttpModule } from "@features/webhooks/vietcombank"
import { ReconcileBankCreditQueueModule } from "@features/jobs/reconcile-bank-credit"
import { CreatePaymentOrderQueueModule } from "@features/jobs/create-payment-order"
import { PaymentOrderRequestsModule } from "@modules/domain/payment-order-requests"
import { BILLING_ERROR_KINDS, BILLING_MESSAGES, BillingModule } from "@modules/domain/billing"
import {
    INBOUND_EVENTS_ERROR_KINDS,
    INBOUND_EVENTS_MESSAGES,
    InboundEventsModule,
} from "@modules/domain/inbound-events"
import {
    PAYMENT_ORDERS_ERROR_KINDS,
    PAYMENT_ORDERS_MESSAGES,
    PaymentOrdersModule,
} from "@modules/domain/payment-orders"
import { CREDITS_ERROR_KINDS, CREDITS_MESSAGES, CreditsModule } from "@modules/domain/credits"
import { AiUsageEventsModule } from "@modules/domain/ai-usage-events"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { WorkspacesHttpModule } from "@features/api/workspaces"
import {
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_MESSAGES,
    AgentConnectionsModule,
} from "@modules/domain/agent-connections"
import {
    AGENT_TOOLS_ERROR_KINDS,
    AGENT_TOOLS_MESSAGES,
    AgentToolsModule,
    UnboundBookingToolsService,
    UnboundConversationLeadsService,
    UnboundHandoffToolService,
    UnboundKnowledgeSearchService,
    UnboundLeadWriterService,
} from "@modules/domain/agent-tools"
import {
    AGENTS_ERROR_KINDS,
    AGENTS_MESSAGES,
    AGENTS_SYNC_FRESH_MS,
    AgentsModule,
    AgentsService,
    UnboundInstallationsService,
    UnboundKnowledgeLensService,
    UnboundModuleProfilesService,
} from "@modules/domain/agents"
import {
    AI_GENERATIONS_ERROR_KINDS,
    AI_GENERATIONS_MESSAGES,
    AI_GENERATIONS_POLL_MS,
    AiGenerationsModule,
    TextGeneratorService,
    UnboundUsageGateService,
} from "@modules/domain/ai-generations"
import { AUTHORITY_ERROR_KINDS, AUTHORITY_MESSAGES } from "@modules/domain/authority"
import { AUTHORITY_RULES_ERROR_KINDS, AUTHORITY_RULES_MESSAGES } from "@modules/domain/authority-rules"
import {
    ApprovalRequesterService,
    DECISIONS_ERROR_KINDS,
    DECISIONS_MESSAGES,
    DecisionsModule,
    UnboundDecisionEventsService,
    UnboundInboundEventStatusService,
    UnboundLeadGenFlowService,
    UnboundOutboundAccessGateService,
    UnboundPaymentReceiptsService,
} from "@modules/domain/decisions"
import { EXECUTIONS_ERROR_KINDS, EXECUTIONS_MESSAGES } from "@modules/domain/executions"
import {
    OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
    OFFICE_COMMAND_CANDIDATES_MESSAGES,
    OfficeCommandCandidatesModule,
} from "@modules/domain/office-command-candidates"
import {
    OPENCLAW_AGENT_SYNC_ERROR_KINDS,
    OPENCLAW_AGENT_SYNC_MESSAGES,
    OPENCLAW_RELOAD_SETTLE_MS,
    OpenclawAgentSyncModule,
} from "@modules/domain/openclaw-agent-sync"
import { RESPONSIBILITY_JOURNAL_MESSAGES } from "@modules/domain/responsibilities"
import { WORK_ITEMS_ERROR_KINDS, WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { DEEPSEEK_ERROR_KINDS, DEEPSEEK_MESSAGES, DeepseekClient, DeepseekModule } from "@modules/integrations/deepseek"
import {
    OPENCLAW_ERROR_KINDS,
    OPENCLAW_MESSAGES,
    OpenclawModule,
    ToolTokenService,
} from "@modules/integrations/openclaw"
import { AGENTS_SYNC_SCHEDULER } from "@modules/queues/agents"
import {
    AGENT_CONVERSATIONS_ERROR_KINDS,
    AGENT_CONVERSATIONS_MESSAGES,
    AgentConversationsModule,
} from "@modules/domain/agent-conversations"
import {
    AGENT_MESSAGES_ERROR_KINDS,
    AGENT_MESSAGES_MESSAGES,
    AgentMessagesModule,
} from "@modules/domain/agent-messages"
import { CHANNELS_ERROR_KINDS, CHANNELS_MESSAGES, ChannelsModule } from "@modules/domain/channels"
import { ChannelReceiptsModule } from "@modules/domain/channel-receipts"
import {
    CONNECTION_SECRETS_ERROR_KINDS,
    CONNECTION_SECRETS_MESSAGES,
    ConnectionSecretsModule,
} from "@modules/domain/connection-secrets"
import { CONNECTIONS_ERROR_KINDS, CONNECTIONS_MESSAGES, ConnectionsModule } from "@modules/domain/connections"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_AUTH,
    SUPABASE_ERROR_KINDS,
    SupabaseModule,
    createSupabaseAccessTokenVerifier,
} from "@modules/integrations/supabase"
import { AUTOMATIONS_ERROR_KINDS, AUTOMATIONS_MESSAGES, AutomationsModule } from "@modules/domain/automations"
import { AutomationCommandsModule } from "@modules/domain/automation-commands"
import { AutomationPortsModule } from "@modules/domain/automation-ports"
import {
    AUTOMATION_PIPELINES_ERROR_KINDS,
    AUTOMATION_PIPELINES_MESSAGES,
    AutomationPipelinesModule,
} from "@modules/domain/automation-pipelines"
import { AUTOMATION_RUNS_MESSAGES, AutomationRunsModule } from "@modules/domain/automation-runs"
import {
    AUTOMATION_TEMPLATES_ERROR_KINDS,
    AUTOMATION_TEMPLATES_MESSAGES,
    AutomationTemplatesModule,
} from "@modules/domain/automation-templates"
import { FlowsModule } from "@modules/domain/flows"
import { N8N_RUNS_ERROR_KINDS, N8N_RUNS_MESSAGES, N8nRunsModule } from "@modules/domain/n8n-runs"
import { MAIL_ERROR_KINDS, MAIL_MESSAGES, MailModule } from "@modules/integrations/mail"
import { TELEGRAM_ERROR_KINDS, TELEGRAM_MESSAGES, TelegramModule } from "@modules/integrations/telegram"
import { ZALO_ERROR_KINDS, ZALO_MESSAGES, ZaloModule } from "@modules/integrations/zalo"
import { CONNECTION_HEALTH_SCHEDULER } from "@modules/queues/connection-health"
import { ZALO_REFRESH_SCHEDULER } from "@modules/queues/zalo-refresh"
import { CONTRACTS_ERROR_KINDS, CONTRACTS_MESSAGES, ContractsModule } from "@modules/domain/contracts"
import { LEADS_ERROR_KINDS, LEADS_MESSAGES, LeadsModule } from "@modules/domain/leads"
import { LivenessModule } from "@modules/domain/liveness"
import { MessagesModule } from "@modules/domain/messages"
import {
    RESPONSIBILITIES_ERROR_KINDS,
    RESPONSIBILITIES_MESSAGES,
    ResponsibilitiesModule,
} from "@modules/domain/responsibilities"
import { AiQuotaOverridesModule } from "@modules/domain/ai-quota-overrides"
import { AppCommandsModule } from "@modules/domain/app-commands"
import {
    PLATFORM_ADMIN_ERROR_KINDS,
    PLATFORM_ADMIN_MESSAGES,
    PlatformAdminModule,
} from "@modules/domain/platform-admin"
import { PlatformAuditModule } from "@modules/domain/platform-audit"
import { AuthorityActionsModule } from "@modules/domain/authority-actions"
import {
    MODULE_CATALOG,
    MODULE_CATEGORIES,
    MODULES_ERROR_KINDS,
    MODULES_MESSAGES,
    ModulesModule,
} from "@modules/domain/modules"
import { PUBLIC_API_ERROR_KINDS, PUBLIC_API_MESSAGES, PublicApiModule } from "@modules/domain/public-api"
import { EventsModule } from "@modules/domain/events"
import {
    WORKSPACE_INVITES_ERROR_KINDS,
    WORKSPACE_INVITES_MESSAGES,
    WorkspaceInvitesModule,
} from "@modules/domain/workspace-invites"
import {
    WORKSPACE_MEMBERS_ERROR_KINDS,
    WORKSPACE_MEMBERS_MESSAGES,
    WorkspaceMembersModule,
} from "@modules/domain/workspace-members"
import { WORKSPACES_ERROR_KINDS, WORKSPACES_MESSAGES, WorkspacesModule } from "@modules/domain/workspaces"
import { N8N_ERROR_KINDS, N8nModule } from "@modules/integrations/n8n"
import { TEMPLATE_FILES_ERROR_KINDS, TemplateFilesModule } from "@modules/integrations/template-files"
import { AUTOMATION_TICK_SCHEDULER } from "@modules/queues/automation"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule } from "@modules/platform/jobs"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES, QueueModule } from "@modules/platform/queue"
import { CONTENT_MESSAGES, ContentModule } from "@modules/domain/content"
import { CONTENT_ITEMS_ERROR_KINDS, CONTENT_ITEMS_MESSAGES, ContentItemsModule } from "@modules/domain/content-items"
import { ContentSettingsModule } from "@modules/domain/content-settings"
import { VIDEO_ERROR_KINDS, VIDEO_MESSAGES, VideoModule } from "@modules/domain/video"
import { VideoProjectVersionsModule } from "@modules/domain/video-project-versions"
import { VideoProjectsModule } from "@modules/domain/video-projects"
import { VIDEO_RENDERS_ERROR_KINDS, VIDEO_RENDERS_MESSAGES, VideoRendersModule } from "@modules/domain/video-renders"
import { FFMPEG_ERROR_KINDS, FFMPEG_MESSAGES, FfmpegModule } from "@modules/integrations/ffmpeg"
import { TTS_ERROR_KINDS, TTS_MESSAGES, TtsModule } from "@modules/integrations/tts"
import { CONTENT_TICK_EVERY_MS, CONTENT_TICK_QUEUE, CONTENT_TICK_SCHEDULER } from "@modules/queues/content-tick"
import { RendersHttpModule } from "@features/api/renders"
import { PublishContentQueueModule } from "@features/jobs/publish-content"
import { IssueInviteQueueModule } from "@features/jobs/issue-invite"
import { RenderVideoQueueModule } from "@features/jobs/render-video"
import { RequestRenderQueueModule } from "@features/jobs/request-render"
import type { ApiOptions } from "./api.options"

@Module({})
/** Composition root of the API: every capability is registered once and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [
                        AUTOMATION_PIPELINES_MESSAGES,
                        AUTOMATION_RUNS_MESSAGES,
                        AUTOMATION_TEMPLATES_MESSAGES,
                        AUTOMATIONS_MESSAGES,
                        AGENT_CONNECTIONS_MESSAGES,
                        AGENT_TOOLS_MESSAGES,
                        AGENTS_MESSAGES,
                        AI_GENERATIONS_MESSAGES,
                        API_KEYS_MESSAGES,
                        AUTHORITY_MESSAGES,
                        AUTHORITY_RULES_MESSAGES,
                        DECISIONS_MESSAGES,
                        DEEPSEEK_MESSAGES,
                        EXECUTIONS_MESSAGES,
                        OFFICE_COMMAND_CANDIDATES_MESSAGES,
                        OPENCLAW_AGENT_SYNC_MESSAGES,
                        OPENCLAW_MESSAGES,
                        RESPONSIBILITY_JOURNAL_MESSAGES,
                        WORK_ITEMS_MESSAGES,
                        AGENT_CONVERSATIONS_MESSAGES,
                        AGENT_MESSAGES_MESSAGES,
                        BILLING_MESSAGES,
                        CREDITS_MESSAGES,
                        INBOUND_EVENTS_MESSAGES,
                        PAYMENT_ORDERS_MESSAGES,
                        CHANNELS_MESSAGES,
                        CONNECTION_SECRETS_MESSAGES,
                        CONNECTIONS_MESSAGES,
                        CONVERSATIONS_MESSAGES,
                        HTTP_MESSAGES,
                        MAIL_MESSAGES,
                        TELEGRAM_MESSAGES,
                        ZALO_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
                        PLATFORM_ADMIN_MESSAGES,
                        JOBS_MESSAGES,
                        N8N_RUNS_MESSAGES,
                        BOOKINGS_MESSAGES,
                        LOYALTY_CAMPAIGNS_MESSAGES,
                        LOYALTY_LEDGER_MESSAGES,
                        LOYALTY_MESSAGES,
                        LOYALTY_OTPS_MESSAGES,
                        LEADS_MESSAGES,
                        RESPONSIBILITIES_MESSAGES,
                        CONTRACTS_MESSAGES,
                        MODULES_MESSAGES,
                        PUBLIC_API_MESSAGES,
                        QUEUE_MESSAGES,
                        WORKSPACE_INVITES_MESSAGES,
                        WORKSPACE_MEMBERS_MESSAGES,
                        WORKSPACES_MESSAGES,
                        FFMPEG_MESSAGES,
                        TTS_MESSAGES,
                        VIDEO_MESSAGES,
                        VIDEO_RENDERS_MESSAGES,
                        CONTENT_MESSAGES,
                        CONTENT_ITEMS_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        AUTOMATION_PIPELINES_ERROR_KINDS,
                        AUTOMATION_TEMPLATES_ERROR_KINDS,
                        AUTOMATIONS_ERROR_KINDS,
                        AGENT_CONNECTIONS_ERROR_KINDS,
                        AGENT_TOOLS_ERROR_KINDS,
                        AGENTS_ERROR_KINDS,
                        AI_GENERATIONS_ERROR_KINDS,
                        API_KEYS_ERROR_KINDS,
                        AUTHORITY_ERROR_KINDS,
                        AUTHORITY_RULES_ERROR_KINDS,
                        DECISIONS_ERROR_KINDS,
                        DEEPSEEK_ERROR_KINDS,
                        EXECUTIONS_ERROR_KINDS,
                        OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
                        OPENCLAW_AGENT_SYNC_ERROR_KINDS,
                        OPENCLAW_ERROR_KINDS,
                        RESPONSIBILITIES_ERROR_KINDS,
                        WORK_ITEMS_ERROR_KINDS,
                        AGENT_CONVERSATIONS_ERROR_KINDS,
                        AGENT_MESSAGES_ERROR_KINDS,
                        BILLING_ERROR_KINDS,
                        CREDITS_ERROR_KINDS,
                        INBOUND_EVENTS_ERROR_KINDS,
                        PAYMENT_ORDERS_ERROR_KINDS,
                        CHANNELS_ERROR_KINDS,
                        CONNECTION_SECRETS_ERROR_KINDS,
                        CONNECTIONS_ERROR_KINDS,
                        CONVERSATIONS_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        MAIL_ERROR_KINDS,
                        TELEGRAM_ERROR_KINDS,
                        ZALO_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        N8N_ERROR_KINDS,
                        N8N_RUNS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        PLATFORM_ADMIN_ERROR_KINDS,
                        MODULES_ERROR_KINDS,
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        TEMPLATE_FILES_ERROR_KINDS,
                        BOOKINGS_ERROR_KINDS,
                        LOYALTY_CAMPAIGNS_ERROR_KINDS,
                        LOYALTY_ERROR_KINDS,
                        LOYALTY_LEDGER_ERROR_KINDS,
                        LOYALTY_OTPS_ERROR_KINDS,
                        LEADS_ERROR_KINDS,
                        CONTRACTS_ERROR_KINDS,
                        WORKSPACE_INVITES_ERROR_KINDS,
                        WORKSPACE_MEMBERS_ERROR_KINDS,
                        WORKSPACES_ERROR_KINDS,
                        FFMPEG_ERROR_KINDS,
                        TTS_ERROR_KINDS,
                        VIDEO_ERROR_KINDS,
                        VIDEO_RENDERS_ERROR_KINDS,
                        CONTENT_ITEMS_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({
                    isGlobal: true,
                    ...options.httpSecurity,
                }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [options.database],
                }),
                QueueModule.register({
                    isGlobal: true,
                    schedulers: [
                        AUTOMATION_TICK_SCHEDULER,
                        AGENTS_SYNC_SCHEDULER,
                        { queue: CONTENT_TICK_QUEUE, id: CONTENT_TICK_SCHEDULER, everyMs: CONTENT_TICK_EVERY_MS },
                        CONNECTION_HEALTH_SCHEDULER,
                        ZALO_REFRESH_SCHEDULER,
                    ],
                    ...options.queue,
                }),
                JobsModule.register({
                    isGlobal: true,
                    connection: PRIMARY_ENTITY_MANAGER,
                    ...options.jobs,
                }),
                SupabaseModule.register({ isGlobal: true, ...options.supabase }),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                ContractsModule.register({ isGlobal: true }),
                LeadsModule.register({ isGlobal: true }),
                MessagesModule.register({ isGlobal: true, agentDirectory: AgentsService }),
                ResponsibilitiesModule.register({ isGlobal: true, agentDirectory: AgentsService }),
                EventsModule.register({ isGlobal: true }),
                WorkspaceMembersModule.register({ isGlobal: true, accounts: SUPABASE_AUTH }),
                WorkspacesModule.register({ isGlobal: true, ...options.workspaces }),
                WorkspaceInvitesModule.register({
                    isGlobal: true,
                    delivery: SUPABASE_AUTH,
                    ...options.workspaceInvites,
                }),
                HttpModule.register({ isGlobal: true }),
                N8nModule.register({ isGlobal: true, ...options.n8n }),
                TemplateFilesModule.register({ isGlobal: true, ...options.templateFiles }),
                AutomationPortsModule.register({ isGlobal: true }),
                AutomationTemplatesModule.register({ isGlobal: true }),
                AutomationPipelinesModule.register({ isGlobal: true }),
                AutomationRunsModule.register({ isGlobal: true }),
                N8nRunsModule.register({ isGlobal: true }),
                AutomationsModule.register({ isGlobal: true }),
                AutomationCommandsModule.register({ isGlobal: true }),
                FlowsModule.register({ isGlobal: true }),
                TelegramModule.register({ isGlobal: true, ...options.telegram }),
                ZaloModule.register({ isGlobal: true, ...options.zalo }),
                MailModule.register({ isGlobal: true, ...options.mail }),
                ConnectionsModule.register({ isGlobal: true }),
                ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
                AgentConversationsModule.register({ isGlobal: true }),
                AgentMessagesModule.register({ isGlobal: true }),
                ChannelReceiptsModule.register({ isGlobal: true }),
                InboundEventsModule.register({ isGlobal: true }),
                ChannelsModule.register({ isGlobal: true, ...options.channels }),
                ConversationsModule.register({ isGlobal: true }),
                TelegramInboxModule.register({ isGlobal: true }),
                ZaloInboxModule.register({ isGlobal: true }),
                FfmpegModule.register({ isGlobal: true, ...options.ffmpeg }),
                TtsModule.register({ isGlobal: true, ...options.tts }),
                VideoRendersModule.register({ isGlobal: true }),
                VideoProjectsModule.register({ isGlobal: true }),
                VideoProjectVersionsModule.register({ isGlobal: true }),
                VideoModule.register({ isGlobal: true, ...options.video }),
                ContentItemsModule.register({ isGlobal: true }),
                ContentSettingsModule.register({ isGlobal: true }),
                ContentModule.register({ isGlobal: true }),
                AppCommandsModule.register({ isGlobal: true }),
                IssueInviteQueueModule,
                RenderVideoQueueModule,
                RequestRenderQueueModule,
                PublishContentQueueModule,
                RendersHttpModule,
                LivenessModule.register({ isGlobal: true }),
                BookingsModule.register({ isGlobal: true }),
                LeadsHttpModule,
                PlatformAuditModule.register({ isGlobal: true }),
                AiQuotaOverridesModule.register({ isGlobal: true }),
                PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
                AuthorityActionsModule.register({ isGlobal: true }),
                OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
                DeepseekModule.register({ isGlobal: true, ...options.deepseek, generator: TextGeneratorService }),
                AgentsModule.register({
                    isGlobal: true,
                    ports: {
                        installations: UnboundInstallationsService,
                        knowledge: UnboundKnowledgeLensService,
                        modules: UnboundModuleProfilesService,
                    },
                    syncFreshMs: AGENTS_SYNC_FRESH_MS,
                }),
                AgentConnectionsModule.register({ isGlobal: true }),
                AiGenerationsModule.register({
                    isGlobal: true,
                    usage: UnboundUsageGateService,
                    pollMs: AI_GENERATIONS_POLL_MS,
                }),
                OpenclawAgentSyncModule.register({ isGlobal: true, reloadSettleMs: OPENCLAW_RELOAD_SETTLE_MS }),
                AgentToolsModule.register({
                    isGlobal: true,
                    ports: {
                        knowledgeSearch: UnboundKnowledgeSearchService,
                        leadWriter: UnboundLeadWriterService,
                        bookingTools: UnboundBookingToolsService,
                        approvalRequester: ApprovalRequesterService,
                        handoffTool: UnboundHandoffToolService,
                        conversationLeads: UnboundConversationLeadsService,
                        toolTokens: ToolTokenService,
                    },
                }),
                DecisionsModule.register({
                    isGlobal: true,
                    ports: {
                        agentDirectory: AgentsService,
                        inboundEventStatus: UnboundInboundEventStatusService,
                        decisionEvents: UnboundDecisionEventsService,
                        paymentReceipts: UnboundPaymentReceiptsService,
                        leadGenFlow: UnboundLeadGenFlowService,
                        outboundAccessGate: UnboundOutboundAccessGateService,
                    },
                }),
                OfficeCommandCandidatesModule.register({ isGlobal: true, reader: DeepseekClient }),
                SyncAgentsQueueModule,
                GenerateWithAgentQueueModule,
                RunDecisionsQueueModule,
                AgentsHttpModule,
                AgentToolsHttpModule,
                DecisionsHttpModule,
                OfficeHttpModule,
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                ModulesHttpModule,
                ApiKeysModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                PaymentOrdersModule.register({ isGlobal: true }),
                BillingModule.register({ isGlobal: true, ...options.billing }),
                SepayTransactionsModule.register({ isGlobal: true }),
                AiUsageEventsModule.register({ isGlobal: true }),
                CreditsModule.register({ isGlobal: true }),
                PaymentOrderRequestsModule.register({ isGlobal: true }),
                ReconcileBankCreditQueueModule,
                CreatePaymentOrderQueueModule,
                CassoHttpModule,
                PayosHttpModule,
                SepayHttpModule,
                VietcombankHttpModule,
                TelegramHttpModule,
                ZaloHttpModule,
                RunChatTurnQueueModule,
                CheckConnectionHealthQueueModule,
                CompleteZaloAuthorizationQueueModule,
                RefreshZaloTokensQueueModule,
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                LoyaltyProgramsModule.register({ isGlobal: true }),
                LoyaltyCustomersModule.register({ isGlobal: true }),
                LoyaltyCustomerLinksModule.register({ isGlobal: true }),
                LoyaltyRewardsModule.register({ isGlobal: true }),
                LoyaltyLedgerModule.register({ isGlobal: true }),
                LoyaltyCampaignsModule.register({ isGlobal: true }),
                LoyaltyOtpsModule.register({ isGlobal: true, pepper: options.supabase.serviceRoleKey.reveal() }),
                LoyaltyModule.register({
                    isGlobal: true,
                    // Until the chat lanes provide the channel adapters nothing delivers a code, so the public points check cannot unlock yet.
                    delivery: { deliver: () => Promise.resolve(false) },
                }),
                PublicBookingHttpModule,
                BookingHttpModule,
                PublicLoyaltyHttpModule,
                LoyaltyHttpModule,
                LoyaltyTillHttpModule,
                WorkspacesHttpModule,
                AutomationsHttpModule,
                FlowsHttpModule,
                N8nPipelinesHttpModule,
                EmitN8nEventQueueModule,
                RunAutomationTickQueueModule,
                RunAutomationCommandQueueModule,
                AdminHttpModule,
            ],
            providers: [
                { provide: SUPABASE_ACCESS_TOKEN_VERIFIER, useValue: verifyAccessToken },
                { provide: APP_FILTER, useClass: ErrorsFilter },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
