import {
    AGENTS_SYNC_FRESH_MS,
    AgentsService,
    UnboundInstallationsService,
    UnboundKnowledgeLensService,
    UnboundModuleProfilesService,
} from "@modules/domain/agents"
import type { AgentsOptions } from "@modules/domain/agents"
import { UnboundBookingToolsService, UnboundKnowledgeSearchService } from "@modules/domain/agent-tools"
import type { AgentToolsModule } from "@modules/domain/agent-tools"
import {
    ApprovalRequesterService,
    UnboundDecisionEventsService,
    UnboundLeadGenFlowService,
    UnboundPaymentReceiptsService,
} from "@modules/domain/decisions"
import type { DecisionsModule } from "@modules/domain/decisions"
import {
    ConversationLeadsService,
    HandoffToolService,
    InboundStatusService,
    LeadWriterService,
    OutboundAccessService,
} from "@modules/domain/work-performers"
import { ToolTokenService } from "@modules/integrations/openclaw"

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
import type { PlatformAdminOptions } from "@modules/domain/platform-admin"
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
    /** The public origin of the web app, for provider return addresses. */
    readonly channels: ChannelsOptions
    /** The Telegram Bot API host. */
    readonly telegram: TelegramOptions
    /** The Zalo OAuth and Open API hosts. */
    readonly zalo: ZaloOptions
    /** Outgoing mail: the platform sender and the private-host policy. */
    readonly mail: MailOptions
    /** The platform team that may use the console. */
    readonly platformAdmin: PlatformAdminOptions
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
    /** The signing secret and the webhook base of the shared n8n workflows. */
    readonly n8n: N8nOptions
    /** How ffmpeg is run. */
    readonly ffmpeg: FfmpegOptions
    /** The text-to-speech provider of the video voiceover. */
    readonly tts: TtsOptions
    /** Where the video renderer finds its assets and how it runs ffmpeg. */
    readonly video: VideoOptions
}

/** The static port bindings consumed by the agent tools registration. */
interface ApiAgentToolsCompositionOptions {
    /** The classes and tokens implementing every agent tool port. */
    readonly ports: Parameters<typeof AgentToolsModule.register>[0]["ports"]
}

/** The static port bindings consumed by the decisions registration. */
interface ApiDecisionsCompositionOptions {
    /** The classes and tokens implementing every decisions port. */
    readonly ports: Parameters<typeof DecisionsModule.register>[0]["ports"]
}

/** Binds the agents' directories and sets the existing sync freshness. */
export const AGENTS_COMPOSITION_OPTIONS: AgentsOptions = {
    ports: {
        installations: UnboundInstallationsService,
        knowledge: UnboundKnowledgeLensService,
        modules: UnboundModuleProfilesService,
    },
    syncFreshMs: AGENTS_SYNC_FRESH_MS,
}

/** Binds the tools to their knowledge, booking, approval and conversation owners. */
export const AGENT_TOOLS_COMPOSITION_OPTIONS: ApiAgentToolsCompositionOptions = {
    ports: {
        knowledgeSearch: UnboundKnowledgeSearchService,
        leadWriter: LeadWriterService,
        bookingTools: UnboundBookingToolsService,
        approvalRequester: ApprovalRequesterService,
        handoffTool: HandoffToolService,
        conversationLeads: ConversationLeadsService,
        toolTokens: ToolTokenService,
    },
}

/** Binds decisions to the directory, inbox, events, payments and outbound access owners. */
export const DECISIONS_COMPOSITION_OPTIONS: ApiDecisionsCompositionOptions = {
    ports: {
        agentDirectory: AgentsService,
        inboundEventStatus: InboundStatusService,
        decisionEvents: UnboundDecisionEventsService,
        paymentReceipts: UnboundPaymentReceiptsService,
        leadGenFlow: UnboundLeadGenFlowService,
        outboundAccessGate: OutboundAccessService,
    },
}
