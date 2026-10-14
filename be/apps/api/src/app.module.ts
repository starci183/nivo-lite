import { Module, type DynamicModule } from "@nestjs/common"
import { APP_FILTER, APP_GUARD } from "@nestjs/core"
import { AutomationsGraphqlModule } from "@features/api/automations"
import { FlowsGraphqlModule } from "@features/api/flows"
import { N8nPipelinesHttpModule } from "@features/api/n8n-pipelines"
import { AgentToolsHttpModule } from "@features/api/agent-tools"
import { AgentsGraphqlModule } from "@features/api/agents"
import { ApiKeysGraphqlModule } from "@features/api/api-keys"
import { DataHubGraphqlModule } from "@features/api/data-hub"
import { HiringGraphqlModule } from "@features/api/hiring"
import { InventoryGraphqlModule } from "@features/api/inventory"
import { ShiftsGraphqlModule } from "@features/api/shifts"
import { OverviewGraphqlModule } from "@features/api/overview"
import { DecisionsGraphqlModule } from "@features/api/decisions"
import { BookingGraphqlModule } from "@features/api/booking"
import { LoyaltyGraphqlModule } from "@features/api/loyalty"
import { LoyaltyTillHttpModule } from "@features/api/loyalty-till"
import { PublicBookingGraphqlModule } from "@features/api/public-booking"
import { PublicLoyaltyGraphqlModule } from "@features/api/public-loyalty"
import { TelegramHttpModule } from "@features/webhooks/telegram"
import { ZaloHttpModule } from "@features/webhooks/zalo"
import { LeadsGraphqlModule } from "@features/api/leads"
import { LeadQueriesGraphqlModule } from "@features/api/lead-queries"
import { LeadActionsGraphqlModule } from "@features/api/lead-actions"
import { SalesGraphqlModule } from "@features/api/sales"
import { SalesWorkbenchGraphqlModule } from "@features/api/sales-workbench"
import { LEAD_ACTIONS_ERROR_KINDS, LEAD_ACTIONS_MESSAGES, LeadActionsModule } from "@modules/domain/lead-actions"
import { SalesModule } from "@modules/domain/sales"
import { SalesWorkbenchModule } from "@modules/domain/sales-workbench"
import { LeadViewsModule } from "@modules/domain/lead-views"
import { AdminGraphqlModule } from "@features/api/admin"
import { ModulesGraphqlModule } from "@features/api/modules"
import { OfficeGraphqlModule } from "@features/api/office"
import { PromoGraphqlModule } from "@features/api/promo"
import { LeadGenGraphqlModule } from "@features/api/leadgen"
import { ChatbotGraphqlModule } from "@features/api/chatbot"
import { ChatReplyGraphqlModule } from "@features/api/chatreply"
import { PromoModule } from "@modules/domain/promo"
import { ChatbotWorkbenchModule } from "@modules/domain/chatbot-workbench"
import { CHATREPLY_ERROR_KINDS, CHATREPLY_MESSAGES, ChatReplyModule } from "@modules/domain/chatreply"
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
import {
    LOYALTY_ERROR_KINDS,
    LOYALTY_MESSAGES,
    LoyaltyCodeDeliveryService,
    LoyaltyModule,
} from "@modules/domain/loyalty"
import { API_KEYS_ERROR_KINDS, API_KEYS_MESSAGES, ApiKeysModule } from "@modules/domain/api-keys"
import { OverviewModule } from "@modules/domain/overview"
import { CassoHttpModule } from "@features/webhooks/casso"
import { PayosHttpModule } from "@features/webhooks/payos"
import { SepayHttpModule } from "@features/webhooks/sepay"
import { SepayFeedHttpModule } from "@features/webhooks/sepay-feed"
import { VietcombankHttpModule } from "@features/webhooks/vietcombank"
import {
    PAYMENT_ORDER_REQUESTS_ERROR_KINDS,
    PAYMENT_ORDER_REQUESTS_MESSAGES,
    PaymentOrderRequestsModule,
} from "@modules/domain/payment-order-requests"
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
import { AI_USAGE_EVENTS_MESSAGES, AiUsageEventsModule, UsageGateService } from "@modules/domain/ai-usage-events"
import { SepayTransactionsModule } from "@modules/domain/sepay-transactions"
import { OrdersGraphqlModule } from "@features/api/orders"
import { BillingGraphqlModule } from "@features/api/billing"
import { CreditsGraphqlModule } from "@features/api/credits"
import { AccountingGraphqlModule } from "@features/api/accounting"
import { AdjustmentsGraphqlModule } from "@features/api/adjustments"
import { AccountingModule } from "@modules/domain/accounting"
import { STAFF_ERROR_KINDS, STAFF_MESSAGES, StaffModule } from "@modules/domain/staff"
import {
    ACCOUNTING_ADJUSTMENTS_ERROR_KINDS,
    ACCOUNTING_ADJUSTMENTS_MESSAGES,
    AccountingAdjustmentsModule,
} from "@modules/domain/accounting-adjustments"
import { WorkspacesGraphqlModule } from "@features/api/workspaces"
import { InboxGraphqlModule } from "@features/api/inbox"
import { AgentChatGraphqlModule } from "@features/api/agentchat"
import { InboxSimulationGraphqlModule } from "@features/api/inbox-simulation"
import { AGENT_CHAT_ERROR_KINDS, AGENT_CHAT_MESSAGES, AgentChatModule } from "@modules/domain/agent-chat"
import {
    INBOX_SIMULATION_ERROR_KINDS,
    INBOX_SIMULATION_MESSAGES,
    InboxSimulationModule,
} from "@modules/domain/inbox-simulation"
import { AccountGraphqlModule } from "@features/api/account"
import { ShellGraphqlModule } from "@features/api/shell"
import { KnowledgeGraphqlModule } from "@features/api/knowledge"
import { EvidenceGraphqlModule } from "@features/api/evidence"
import {
    EMAIL_MESSAGES_ERROR_KINDS,
    EMAIL_MESSAGES_MESSAGES,
    EmailMessagesModule,
} from "@modules/domain/email-messages"
import { INVOICES_ERROR_KINDS, INVOICES_MESSAGES, InvoicesModule } from "@modules/domain/invoices"
import { ORDERS_ERROR_KINDS, ORDERS_MESSAGES, OrdersModule } from "@modules/domain/orders"
import { TRANSACTIONS_ERROR_KINDS, TRANSACTIONS_MESSAGES, TransactionsModule } from "@modules/domain/transactions"
import {
    WORK_PERFORMERS_ERROR_KINDS,
    WORK_PERFORMERS_MESSAGES,
    WorkPerformersModule,
} from "@modules/domain/work-performers"
import {
    AGENT_CONNECTIONS_ERROR_KINDS,
    AGENT_CONNECTIONS_MESSAGES,
    AgentConnectionsModule,
} from "@modules/domain/agent-connections"
import { AGENT_TOOLS_ERROR_KINDS, AGENT_TOOLS_MESSAGES, AgentToolsModule } from "@modules/domain/agent-tools"
import {
    AGENTS_ERROR_KINDS,
    AGENTS_MESSAGES,
    AGENTS_SYNC_FRESH_MS,
    AgentsModule,
    AgentsService,
} from "@modules/domain/agents"
import {
    AI_GENERATIONS_ERROR_KINDS,
    AI_GENERATIONS_MESSAGES,
    AI_GENERATIONS_POLL_MS,
    AiGenerationsModule,
    TextGeneratorService,
} from "@modules/domain/ai-generations"
import { AUTHORITY_ERROR_KINDS, AUTHORITY_MESSAGES } from "@modules/domain/authority"
import { AUTHORITY_RULES_ERROR_KINDS, AUTHORITY_RULES_MESSAGES } from "@modules/domain/authority-rules"
import { DecisionsModule } from "@modules/domain/decisions"
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
import { WORK_ITEMS_ERROR_KINDS, WORK_ITEMS_MESSAGES } from "@modules/domain/work-items"
import { DEEPSEEK_ERROR_KINDS, DEEPSEEK_MESSAGES, DeepseekClient, DeepseekModule } from "@modules/integrations/deepseek"
import { OPENCLAW_ERROR_KINDS, OPENCLAW_MESSAGES, OpenclawModule } from "@modules/integrations/openclaw"
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
import { DATA_HUB_ERROR_KINDS, DATA_HUB_MESSAGES, DataHubModule } from "@modules/domain/data-hub"
import { DataRecordsModule } from "@modules/domain/data-records"
import { DataSyncRunsModule } from "@modules/domain/data-sync-runs"
import { DATA_SOURCES_ERROR_KINDS, DataSourcesModule } from "@modules/integrations/data-sources"
import { TelegramUserModule } from "@modules/integrations/telegram-user"
import { CONVERSATIONS_ERROR_KINDS, CONVERSATIONS_MESSAGES, ConversationsModule } from "@modules/domain/conversations"
import { TelegramInboxModule } from "@modules/domain/telegram-inbox"
import { ZaloInboxModule } from "@modules/domain/zalo-inbox"
import { ZaloWizardDraftsModule } from "@modules/domain/zalo-wizard-drafts"
import { AuthGuard, IDENTITY_ERROR_KINDS, IDENTITY_MESSAGES, IdentityModule } from "@modules/domain/identity"
import { BRAIN_ERROR_KINDS, BRAIN_MESSAGES, BrainModule } from "@modules/domain/brain"
import { BrainCommandsModule } from "@modules/domain/brain-commands"
import { BrainEvalCasesModule } from "@modules/domain/brain-eval-cases"
import { BrainExtractionsModule } from "@modules/domain/brain-extractions"
import { BRAIN_FACTS_ERROR_KINDS, BRAIN_FACTS_MESSAGES, BrainFactsModule } from "@modules/domain/brain-facts"
import { BRAIN_LESSONS_ERROR_KINDS, BRAIN_LESSONS_MESSAGES, BrainLessonsModule } from "@modules/domain/brain-lessons"
import { KnowledgeChunksModule } from "@modules/domain/knowledge-chunks"
import { KnowledgeGapsModule } from "@modules/domain/knowledge-gaps"
import { KnowledgeSuggestionStateModule } from "@modules/domain/knowledge-suggestion-state"
import { KNOWLEDGE_ERROR_KINDS, KNOWLEDGE_MESSAGES, KnowledgeModule } from "@modules/domain/knowledge"
import {
    KNOWLEDGE_SOURCES_ERROR_KINDS,
    KNOWLEDGE_SOURCES_MESSAGES,
    KnowledgeSourcesModule,
} from "@modules/domain/knowledge-sources"
import {
    CORE_FOLDER,
    NIVO_KNOWLEDGE_ERROR_KINDS,
    NIVO_KNOWLEDGE_MESSAGES,
    NivoKnowledgeModule,
} from "@modules/domain/nivo-knowledge"
import { DOCUMENTS_ERROR_KINDS, DOCUMENTS_MESSAGES, DocumentsModule } from "@modules/integrations/documents"
import { LlmModule } from "@modules/integrations/llm"
import {
    SUPABASE_ACCESS_TOKEN_VERIFIER,
    SUPABASE_AUTH,
    SUPABASE_ERROR_KINDS,
    SUPABASE_OBJECTS,
    SUPABASE_STORAGE,
    SupabaseModule,
    createSupabaseAccessTokenVerifier,
} from "@modules/integrations/supabase"
import { INVENTORY_ERROR_KINDS, INVENTORY_MESSAGES, InventoryModule } from "@modules/domain/inventory"
import { SHIFTS_ERROR_KINDS, SHIFTS_MESSAGES, ShiftsModule } from "@modules/domain/shifts"
import { HIRING_ERROR_KINDS, HIRING_MESSAGES, HiringModule } from "@modules/domain/hiring"
import { ModuleOpsModule } from "@modules/domain/module-ops"
import { AutomationsModule } from "@modules/domain/automations"
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
import { JOB_OPS_ERROR_KINDS, JobOpsModule } from "@modules/domain/job-ops"
import { MessagesModule } from "@modules/domain/messages"
import {
    RESPONSIBILITIES_ERROR_KINDS,
    RESPONSIBILITIES_MESSAGES,
    RESPONSIBILITY_JOURNAL_MESSAGES,
    ResponsibilitiesModule,
} from "@modules/domain/responsibilities"
import { AiQuotaOverridesModule } from "@modules/domain/ai-quota-overrides"
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
import { ClockModule } from "@modules/platform/clock"
import { IdsModule } from "@modules/platform/ids"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DatabaseModule, PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AppErrorsModule } from "@modules/domain/app-errors"
import { ERRORS_MESSAGES, ErrorsFilter, ErrorsModule } from "@modules/platform/errors"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import { GraphqlModule } from "@modules/platform/graphql"
import { I18nModule } from "@modules/platform/i18n"
import { LoggingModule } from "@modules/platform/logging"
import { JOBS_ERROR_KINDS, JOBS_MESSAGES, JobsModule } from "@modules/platform/jobs"
import { QUEUE_ERROR_KINDS, QUEUE_MESSAGES, QueueModule } from "@modules/platform/queue"
import {
    CONNECTION_GRANTS_ERROR_KINDS,
    CONNECTION_GRANTS_MESSAGES,
    ConnectionGrantsModule,
} from "@modules/domain/connection-grants"
import {
    CHANNEL_CONNECTIONS_ERROR_KINDS,
    CHANNEL_CONNECTIONS_MESSAGES,
    ChannelConnectionsModule,
} from "@modules/domain/channel-connections"
import {
    WEBHOOK_CONNECTIONS_ERROR_KINDS,
    WEBHOOK_CONNECTIONS_MESSAGES,
    WebhookConnectionsModule,
} from "@modules/domain/webhook-connections"
import {
    GOOGLE_CONNECTIONS_ERROR_KINDS,
    GOOGLE_CONNECTIONS_MESSAGES,
    GoogleConnectionsModule,
} from "@modules/domain/google-connections"
import {
    META_CONNECTIONS_ERROR_KINDS,
    META_CONNECTIONS_MESSAGES,
    MetaConnectionsModule,
} from "@modules/domain/meta-connections"
import { META_INBOX_ERROR_KINDS, META_INBOX_MESSAGES, MetaInboxModule } from "@modules/domain/meta-inbox"
import { ConnectionLifecycleModule } from "@modules/domain/connection-lifecycle"
import { ConnectionCommandsModule } from "@modules/domain/connection-commands"
import { GOOGLE_ERROR_KINDS, GOOGLE_MESSAGES, GoogleModule } from "@modules/integrations/google"
import { META_ERROR_KINDS, META_MESSAGES, MetaModule } from "@modules/integrations/meta"
import {
    CHANNEL_SETUP_ERROR_KINDS,
    CHANNEL_SETUP_MESSAGES,
    ChannelSetupModule,
} from "@modules/integrations/channel-setup"
import {
    WEBHOOK_DELIVERY_ERROR_KINDS,
    WEBHOOK_DELIVERY_MESSAGES,
    WebhookDeliveryModule,
} from "@modules/integrations/webhook-delivery"
import { GoogleConnectionsHttpModule } from "@features/api/google-connections"
import { MetaConnectionsHttpModule } from "@features/api/meta-connections"
import { ConnectionsGraphqlModule } from "@features/api/connections"
import { CONTENT_MESSAGES, ContentModule } from "@modules/domain/content"
import { CONTENT_ITEMS_ERROR_KINDS, CONTENT_ITEMS_MESSAGES, ContentItemsModule } from "@modules/domain/content-items"
import {
    CONTENT_SETTINGS_ERROR_KINDS,
    CONTENT_SETTINGS_MESSAGES,
    ContentSettingsModule,
} from "@modules/domain/content-settings"
import { CONTENT_PLANS_ERROR_KINDS, CONTENT_PLANS_MESSAGES, ContentPlansModule } from "@modules/domain/content-plans"
import { ContentPillarsModule } from "@modules/domain/content-pillars"
import { ContentCadenceModule } from "@modules/domain/content-cadence"
import {
    CONTENT_AI_ERROR_KINDS,
    CONTENT_AI_MESSAGES,
    ContentAiModule,
    ContentGenerationCompletionService,
} from "@modules/domain/content-ai"
import {
    CONTENT_PUBLISHING_ERROR_KINDS,
    CONTENT_PUBLISHING_MESSAGES,
    ContentPublishingModule,
} from "@modules/domain/content-publishing"
import { CONTENT_MEDIA_ERROR_KINDS, CONTENT_MEDIA_MESSAGES, ContentMediaModule } from "@modules/domain/content-media"
import { ContentGraphqlModule } from "@features/api/content"
import { ContentSettingsGraphqlModule } from "@features/api/content-settings"
import { ContentAiGraphqlModule } from "@features/api/content-ai"
import { ContentPublishingGraphqlModule } from "@features/api/content-publishing"
import { ContentMediaGraphqlModule } from "@features/api/content-media"
import { VideoGraphqlModule } from "@features/api/video"
import { VIDEO_ERROR_KINDS, VIDEO_MESSAGES, VideoModule } from "@modules/domain/video"
import { VideoProjectVersionsModule } from "@modules/domain/video-project-versions"
import { VideoProjectsModule } from "@modules/domain/video-projects"
import { VIDEO_RENDERS_ERROR_KINDS, VIDEO_RENDERS_MESSAGES, VideoRendersModule } from "@modules/domain/video-renders"
import { FFMPEG_ERROR_KINDS, FFMPEG_MESSAGES, FfmpegModule } from "@modules/integrations/ffmpeg"
import { TTS_ERROR_KINDS, TTS_MESSAGES, TtsModule } from "@modules/integrations/tts"
import { RendersGraphqlModule } from "@features/api/renders"
import { CUSTOMER_TURNS_MESSAGES, CustomerTurnsModule } from "@modules/domain/customer-turns"
import {
    AGENT_TOOLS_PORTS,
    API_JOB_QUEUES,
    API_SCHEDULERS,
    API_SYSTEM,
    API_SYSTEM_CAPABILITIES,
    DECISIONS_PORTS,
    G19_PORTS,
    LEAD_LANE,
    type ApiOptions,
    TELEGRAM_USER_ERRORS,
} from "./api.options"
@Module({}) /** Every capability is registered once and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the module from options parsed once at boot; nothing here reads the environment. */
    static register(options: ApiOptions): DynamicModule {
        const verifyAccessToken = createSupabaseAccessTokenVerifier(options.supabase)
        return {
            module: AppModule,
            imports: [
                ...[ClockModule, IdsModule, LoggingModule].map((module) => module.register({ isGlobal: true })),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [
                        DOCUMENTS_MESSAGES,
                        CHATREPLY_MESSAGES,
                        CONNECTIONS_MESSAGES,
                        DATA_HUB_MESSAGES,
                        CONNECTION_GRANTS_MESSAGES,
                        CHANNEL_CONNECTIONS_MESSAGES,
                        WEBHOOK_CONNECTIONS_MESSAGES,
                        GOOGLE_CONNECTIONS_MESSAGES,
                        META_CONNECTIONS_MESSAGES,
                        META_INBOX_MESSAGES,
                        GOOGLE_MESSAGES,
                        META_MESSAGES,
                        CHANNEL_SETUP_MESSAGES,
                        WEBHOOK_DELIVERY_MESSAGES,
                        HTTP_MESSAGES,
                        AUTOMATION_PIPELINES_MESSAGES,
                        AUTOMATION_RUNS_MESSAGES,
                        AUTOMATION_TEMPLATES_MESSAGES,
                        ...G19_PORTS.messages,
                        AGENT_CONNECTIONS_MESSAGES,
                        AGENT_TOOLS_MESSAGES,
                        AGENTS_MESSAGES,
                        AI_GENERATIONS_MESSAGES,
                        AI_USAGE_EVENTS_MESSAGES,
                        EMAIL_MESSAGES_MESSAGES,
                        INVOICES_MESSAGES,
                        ORDERS_MESSAGES,
                        TRANSACTIONS_MESSAGES,
                        WORK_PERFORMERS_MESSAGES,
                        API_KEYS_MESSAGES,
                        AUTHORITY_MESSAGES,
                        AUTHORITY_RULES_MESSAGES,
                        DEEPSEEK_MESSAGES,
                        EXECUTIONS_MESSAGES,
                        OFFICE_COMMAND_CANDIDATES_MESSAGES,
                        OPENCLAW_AGENT_SYNC_MESSAGES,
                        OPENCLAW_MESSAGES,
                        RESPONSIBILITY_JOURNAL_MESSAGES,
                        WORK_ITEMS_MESSAGES,
                        STAFF_MESSAGES,
                        AGENT_CONVERSATIONS_MESSAGES,
                        AGENT_MESSAGES_MESSAGES,
                        BILLING_MESSAGES,
                        LEAD_ACTIONS_MESSAGES,
                        AGENT_CHAT_MESSAGES,
                        INBOX_SIMULATION_MESSAGES,
                        ACCOUNTING_ADJUSTMENTS_MESSAGES,
                        PAYMENT_ORDER_REQUESTS_MESSAGES,
                        CREDITS_MESSAGES,
                        INBOUND_EVENTS_MESSAGES,
                        PAYMENT_ORDERS_MESSAGES,
                        CHANNELS_MESSAGES,
                        CONNECTION_SECRETS_MESSAGES,
                        CONVERSATIONS_MESSAGES,
                        CUSTOMER_TURNS_MESSAGES,
                        MAIL_MESSAGES,
                        TELEGRAM_MESSAGES,
                        ZALO_MESSAGES,
                        ERRORS_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        IDENTITY_MESSAGES,
                        INVENTORY_MESSAGES,
                        SHIFTS_MESSAGES,
                        HIRING_MESSAGES,
                        JOBS_MESSAGES,
                        PLATFORM_ADMIN_MESSAGES,
                        BRAIN_FACTS_MESSAGES,
                        BRAIN_LESSONS_MESSAGES,
                        BRAIN_MESSAGES,
                        KNOWLEDGE_MESSAGES,
                        KNOWLEDGE_SOURCES_MESSAGES,
                        N8N_RUNS_MESSAGES,
                        BOOKINGS_MESSAGES,
                        LOYALTY_CAMPAIGNS_MESSAGES,
                        LOYALTY_LEDGER_MESSAGES,
                        LOYALTY_MESSAGES,
                        LOYALTY_OTPS_MESSAGES,
                        ...LEAD_LANE.messages,
                        RESPONSIBILITIES_MESSAGES,
                        ...API_SYSTEM.messages,
                        MODULES_MESSAGES,
                        NIVO_KNOWLEDGE_MESSAGES,
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
                        CONTENT_SETTINGS_MESSAGES,
                        CONTENT_AI_MESSAGES,
                        CONTENT_PLANS_MESSAGES,
                        CONTENT_PUBLISHING_MESSAGES,
                        CONTENT_MEDIA_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CONNECTIONS_ERROR_KINDS,
                        DATA_HUB_ERROR_KINDS,
                        DATA_SOURCES_ERROR_KINDS,
                        CHATREPLY_ERROR_KINDS,
                        CONNECTION_GRANTS_ERROR_KINDS,
                        CHANNEL_CONNECTIONS_ERROR_KINDS,
                        WEBHOOK_CONNECTIONS_ERROR_KINDS,
                        GOOGLE_CONNECTIONS_ERROR_KINDS,
                        META_CONNECTIONS_ERROR_KINDS,
                        META_INBOX_ERROR_KINDS,
                        GOOGLE_ERROR_KINDS,
                        META_ERROR_KINDS,
                        CHANNEL_SETUP_ERROR_KINDS,
                        WEBHOOK_DELIVERY_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        JOB_OPS_ERROR_KINDS,
                        AUTOMATION_PIPELINES_ERROR_KINDS,
                        AUTOMATION_TEMPLATES_ERROR_KINDS,
                        ...G19_PORTS.errorKinds,
                        AGENT_CONNECTIONS_ERROR_KINDS,
                        AGENT_TOOLS_ERROR_KINDS,
                        AGENTS_ERROR_KINDS,
                        AI_GENERATIONS_ERROR_KINDS,
                        EMAIL_MESSAGES_ERROR_KINDS,
                        INVOICES_ERROR_KINDS,
                        ORDERS_ERROR_KINDS,
                        TRANSACTIONS_ERROR_KINDS,
                        WORK_PERFORMERS_ERROR_KINDS,
                        API_KEYS_ERROR_KINDS,
                        AUTHORITY_ERROR_KINDS,
                        AUTHORITY_RULES_ERROR_KINDS,
                        DEEPSEEK_ERROR_KINDS,
                        EXECUTIONS_ERROR_KINDS,
                        OFFICE_COMMAND_CANDIDATES_ERROR_KINDS,
                        OPENCLAW_AGENT_SYNC_ERROR_KINDS,
                        OPENCLAW_ERROR_KINDS,
                        RESPONSIBILITIES_ERROR_KINDS,
                        WORK_ITEMS_ERROR_KINDS,
                        STAFF_ERROR_KINDS,
                        AGENT_CONVERSATIONS_ERROR_KINDS,
                        AGENT_MESSAGES_ERROR_KINDS,
                        BILLING_ERROR_KINDS,
                        LEAD_ACTIONS_ERROR_KINDS,
                        AGENT_CHAT_ERROR_KINDS,
                        INBOX_SIMULATION_ERROR_KINDS,
                        ACCOUNTING_ADJUSTMENTS_ERROR_KINDS,
                        PAYMENT_ORDER_REQUESTS_ERROR_KINDS,
                        CREDITS_ERROR_KINDS,
                        INBOUND_EVENTS_ERROR_KINDS,
                        PAYMENT_ORDERS_ERROR_KINDS,
                        CHANNELS_ERROR_KINDS,
                        CONNECTION_SECRETS_ERROR_KINDS,
                        CONVERSATIONS_ERROR_KINDS,
                        MAIL_ERROR_KINDS,
                        TELEGRAM_ERROR_KINDS,
                        ZALO_ERROR_KINDS,
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        DOCUMENTS_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        JOBS_ERROR_KINDS,
                        BRAIN_ERROR_KINDS,
                        BRAIN_FACTS_ERROR_KINDS,
                        BRAIN_LESSONS_ERROR_KINDS,
                        KNOWLEDGE_ERROR_KINDS,
                        KNOWLEDGE_SOURCES_ERROR_KINDS,
                        N8N_ERROR_KINDS,
                        N8N_RUNS_ERROR_KINDS,
                        QUEUE_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        INVENTORY_ERROR_KINDS,
                        SHIFTS_ERROR_KINDS,
                        HIRING_ERROR_KINDS,
                        PLATFORM_ADMIN_ERROR_KINDS,
                        MODULES_ERROR_KINDS,
                        NIVO_KNOWLEDGE_ERROR_KINDS,
                        PUBLIC_API_ERROR_KINDS,
                        SUPABASE_ERROR_KINDS,
                        BOOKINGS_ERROR_KINDS,
                        LOYALTY_CAMPAIGNS_ERROR_KINDS,
                        LOYALTY_ERROR_KINDS,
                        LOYALTY_LEDGER_ERROR_KINDS,
                        LOYALTY_OTPS_ERROR_KINDS,
                        ...LEAD_LANE.kinds,
                        ...API_SYSTEM.kinds,
                        WORKSPACE_INVITES_ERROR_KINDS,
                        WORKSPACE_MEMBERS_ERROR_KINDS,
                        WORKSPACES_ERROR_KINDS,
                        FFMPEG_ERROR_KINDS,
                        TTS_ERROR_KINDS,
                        VIDEO_ERROR_KINDS,
                        VIDEO_RENDERS_ERROR_KINDS,
                        CONTENT_ITEMS_ERROR_KINDS,
                        CONTENT_SETTINGS_ERROR_KINDS,
                        CONTENT_AI_ERROR_KINDS,
                        CONTENT_PLANS_ERROR_KINDS,
                        CONTENT_PUBLISHING_ERROR_KINDS,
                        CONTENT_MEDIA_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
                DatabaseModule.register({ isGlobal: true, connections: [options.database] }),
                AppErrorsModule.register({ isGlobal: true }),
                QueueModule.register({ isGlobal: true, schedulers: API_SCHEDULERS, ...options.queue }),
                JobsModule.register({ isGlobal: true, connection: PRIMARY_ENTITY_MANAGER, ...options.jobs }),
                JobOpsModule.register({ isGlobal: true, alerts: options.jobsAlert }),
                SupabaseModule.register({ isGlobal: true, ...options.supabase }),
                IdentityModule.register({ isGlobal: true, verifyAccessToken }),
                ...LEAD_LANE.capabilities.map((capability) => capability.register({ isGlobal: true })),
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
                ConnectionsModule.register({ isGlobal: true, ...options.connections }),
                ConnectionGrantsModule.register({ isGlobal: true }),
                DataSourcesModule.register({ isGlobal: true, ...options.dataSources }),
                TelegramUserModule.register({ isGlobal: true, ...options.telegramUser, errors: TELEGRAM_USER_ERRORS }),
                DataRecordsModule.register({ isGlobal: true }),
                DataSyncRunsModule.register({ isGlobal: true }),
                DataHubModule.register({ isGlobal: true }),
                ChannelConnectionsModule.register({ isGlobal: true }),
                WebhookConnectionsModule.register({ isGlobal: true, ...options.webhookConnections }),
                GoogleConnectionsModule.register({ isGlobal: true }),
                MetaConnectionsModule.register({ isGlobal: true }),
                MetaInboxModule.register({ isGlobal: true, taker: LEAD_LANE.metaTaker }),
                ConnectionLifecycleModule.register({ isGlobal: true }),
                ConnectionCommandsModule.register({ isGlobal: true }),
                GoogleModule.register({ isGlobal: true, ...options.google }),
                MetaModule.register({ isGlobal: true, ...options.meta }),
                ChannelSetupModule.register({ isGlobal: true, ...options.channelSetup }),
                WebhookDeliveryModule.register({ isGlobal: true, ...options.webhookDelivery }),
                ...[HttpModule.register({ isGlobal: true }), GraphqlModule.register({ isGlobal: true })],
                N8nModule.register({ isGlobal: true, ...options.n8n }),
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
                ConnectionSecretsModule.register({ isGlobal: true, ...options.connectionSecrets }),
                AgentConversationsModule.register({ isGlobal: true }),
                AgentMessagesModule.register({ isGlobal: true }),
                ChannelReceiptsModule.register({ isGlobal: true }),
                InboundEventsModule.register({ isGlobal: true }),
                ChannelsModule.register({ isGlobal: true, ...options.channels }),
                ConversationsModule.register({ isGlobal: true, ...G19_PORTS.chatTurn }),
                CustomerTurnsModule.register({ isGlobal: true }),
                TelegramInboxModule.register({ isGlobal: true }),
                ZaloInboxModule.register({ isGlobal: true }),
                ZaloWizardDraftsModule.register({ isGlobal: true }),
                FfmpegModule.register({ isGlobal: true, ...options.ffmpeg }),
                TtsModule.register({ isGlobal: true, ...options.tts }),
                VideoRendersModule.register({ isGlobal: true }),
                VideoProjectsModule.register({ isGlobal: true }),
                VideoProjectVersionsModule.register({ isGlobal: true }),
                VideoModule.register({ isGlobal: true, ...options.video, assets: SUPABASE_STORAGE }),
                InventoryModule.register({ isGlobal: true }),
                ShiftsModule.register({ isGlobal: true }),
                HiringModule.register({ isGlobal: true, ...options.channels }),
                ...API_JOB_QUEUES,
                ContentItemsModule.register({ isGlobal: true }),
                ContentSettingsModule.register({ isGlobal: true }),
                ContentPillarsModule.register({ isGlobal: true }),
                ContentCadenceModule.register({ isGlobal: true }),
                ContentAiModule.register({ isGlobal: true }),
                ContentPlansModule.register({ isGlobal: true }),
                ContentPublishingModule.register({ isGlobal: true }),
                ContentMediaModule.register({ isGlobal: true, storage: SUPABASE_OBJECTS }),
                ContentGraphqlModule,
                ContentSettingsGraphqlModule,
                ContentAiGraphqlModule,
                ContentPublishingGraphqlModule,
                ContentMediaGraphqlModule,
                VideoGraphqlModule,
                ContentModule.register({ isGlobal: true }),
                RendersGraphqlModule,
                ...API_SYSTEM_CAPABILITIES.map((capability) => capability.register({ isGlobal: true })),
                ModuleOpsModule.register({ isGlobal: true, ports: G19_PORTS.moduleOps }),
                LlmModule.register({ isGlobal: true, ...options.llm }),
                DocumentsModule.register({ isGlobal: true, ...options.documents }),
                KnowledgeSourcesModule.register({ isGlobal: true, storage: SUPABASE_OBJECTS }),
                KnowledgeChunksModule.register({ isGlobal: true }),
                KnowledgeSuggestionStateModule.register({ isGlobal: true }),
                NivoKnowledgeModule.register({
                    isGlobal: true,
                    folders: [CORE_FOLDER, ...MODULE_CATALOG.map((module) => module.knowledgeFolder)],
                }),
                KnowledgeModule.register({ isGlobal: true, driveAccess: G19_PORTS.driveAccess }),
                BrainFactsModule.register({ isGlobal: true }),
                KnowledgeGapsModule.register({ isGlobal: true }),
                BrainLessonsModule.register({ isGlobal: true }),
                BrainExtractionsModule.register({ isGlobal: true }),
                BrainCommandsModule.register({ isGlobal: true }),
                BrainEvalCasesModule.register({ isGlobal: true }),
                BrainModule.register({ isGlobal: true, corrections: { recent: () => Promise.resolve([]) } }),
                BookingsModule.register({ isGlobal: true }),
                LeadsGraphqlModule,
                LeadQueriesGraphqlModule,
                LeadActionsGraphqlModule,
                SalesGraphqlModule,
                SalesWorkbenchGraphqlModule,
                LeadActionsModule.register({ isGlobal: true }),
                LeadViewsModule.register({ isGlobal: true }),
                SalesModule.register({ isGlobal: true }),
                SalesWorkbenchModule.register({ isGlobal: true }),
                PromoModule.register({ isGlobal: true }),
                ChatReplyModule.register({ isGlobal: true }),
                PromoGraphqlModule,
                LeadGenGraphqlModule,
                ChatbotWorkbenchModule.register({ isGlobal: true }),
                ChatbotGraphqlModule,
                ChatReplyGraphqlModule,
                PlatformAuditModule.register({ isGlobal: true }),
                AiQuotaOverridesModule.register({ isGlobal: true }),
                PlatformAdminModule.register({ isGlobal: true, ...options.platformAdmin }),
                AuthorityActionsModule.register({ isGlobal: true }),
                OpenclawModule.register({ isGlobal: true, ...options.openclaw }),
                DeepseekModule.register({ isGlobal: true, ...options.deepseek, generator: TextGeneratorService }),
                AgentsModule.register({ isGlobal: true, ports: G19_PORTS.agents, syncFreshMs: AGENTS_SYNC_FRESH_MS }),
                AgentConnectionsModule.register({ isGlobal: true }),
                AiGenerationsModule.register({
                    isGlobal: true,
                    usage: UsageGateService,
                    pollMs: AI_GENERATIONS_POLL_MS,
                    completion: ContentGenerationCompletionService,
                }),
                OpenclawAgentSyncModule.register({ isGlobal: true, reloadSettleMs: OPENCLAW_RELOAD_SETTLE_MS }),
                AgentToolsModule.register({ isGlobal: true, ports: AGENT_TOOLS_PORTS }),
                DecisionsModule.register({ isGlobal: true, ports: DECISIONS_PORTS }),
                OrdersModule.register({ isGlobal: true }),
                OrdersGraphqlModule,
                StaffModule.register({ isGlobal: true }),
                AccountingAdjustmentsModule.register({ isGlobal: true }),
                AccountingModule.register({ isGlobal: true }),
                AccountingGraphqlModule,
                AdjustmentsGraphqlModule,
                InvoicesModule.register({ isGlobal: true }),
                TransactionsModule.register({ isGlobal: true }),
                EmailMessagesModule.register({ isGlobal: true }),
                WorkPerformersModule.register({ isGlobal: true, writer: DeepseekClient }),
                OfficeCommandCandidatesModule.register({ isGlobal: true, reader: DeepseekClient }),
                AgentsGraphqlModule,
                AgentToolsHttpModule,
                DecisionsGraphqlModule,
                OfficeGraphqlModule,
                ModulesModule.register({ isGlobal: true, categories: MODULE_CATEGORIES, catalog: MODULE_CATALOG }),
                ModulesGraphqlModule,
                ApiKeysModule.register({ isGlobal: true }),
                OverviewModule.register({ isGlobal: true }),
                PublicApiModule.register({ isGlobal: true }),
                PaymentOrdersModule.register({ isGlobal: true }),
                BillingModule.register({ isGlobal: true, ...options.billing }),
                BillingGraphqlModule,
                SepayTransactionsModule.register({ isGlobal: true }),
                AiUsageEventsModule.register({ isGlobal: true }),
                CreditsModule.register({ isGlobal: true }),
                CreditsGraphqlModule,
                PaymentOrderRequestsModule.register({ isGlobal: true }),
                CassoHttpModule,
                PayosHttpModule,
                SepayHttpModule,
                SepayFeedHttpModule,
                VietcombankHttpModule,
                TelegramHttpModule,
                ZaloHttpModule,
                ExternalApiHttpModule,
                SystemHealthHttpModule,
                LoyaltyProgramsModule.register({ isGlobal: true }),
                LoyaltyCustomersModule.register({ isGlobal: true }),
                LoyaltyCustomerLinksModule.register({ isGlobal: true }),
                LoyaltyRewardsModule.register({ isGlobal: true }),
                LoyaltyLedgerModule.register({ isGlobal: true }),
                LoyaltyCampaignsModule.register({ isGlobal: true }),
                LoyaltyOtpsModule.register({ isGlobal: true, ...options.loyaltyOtps }),
                LoyaltyModule.register({ isGlobal: true, delivery: LoyaltyCodeDeliveryService }),
                PublicBookingGraphqlModule,
                BookingGraphqlModule,
                PublicLoyaltyGraphqlModule,
                LoyaltyGraphqlModule,
                LoyaltyTillHttpModule,
                WorkspacesGraphqlModule,
                ApiKeysGraphqlModule,
                InventoryGraphqlModule,
                ShiftsGraphqlModule,
                HiringGraphqlModule,
                OverviewGraphqlModule,
                AccountGraphqlModule,
                ShellGraphqlModule,
                ConnectionsGraphqlModule,
                DataHubGraphqlModule,
                InboxGraphqlModule,
                AgentChatGraphqlModule,
                InboxSimulationGraphqlModule,
                InboxSimulationModule.register({ isGlobal: true }),
                AgentChatModule.register({ isGlobal: true }),
                KnowledgeGraphqlModule,
                EvidenceGraphqlModule,
                GoogleConnectionsHttpModule,
                MetaConnectionsHttpModule,
                AutomationsGraphqlModule,
                FlowsGraphqlModule,
                N8nPipelinesHttpModule,
                AdminGraphqlModule,
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
