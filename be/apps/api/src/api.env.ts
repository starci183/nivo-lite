import { parseKnowledgeConfig } from "@modules/domain/knowledge"
import { parseBillingConfig } from "@modules/domain/billing"
import { parseServerConfig, type EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseJobsAlertConfig } from "@modules/domain/job-ops"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseRealtimeConfig } from "@modules/platform/realtime"
import { parseChannelsConfig } from "@modules/domain/channels"
import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseLoyaltyOtpsConfig } from "@modules/domain/loyalty-otps"
import { parseDataSourcesConfig } from "@modules/integrations/data-sources"
import { parseTelegramUserConfig } from "@modules/integrations/telegram-user"
import { parseMailConfig } from "@modules/integrations/mail"
import { parseTelegramConfig } from "@modules/integrations/telegram"
import { parseZaloConfig } from "@modules/integrations/zalo"
import { parseMcpGatewayConfig } from "@modules/domain/mcp-gateway"
import { parseMcpConfig } from "@modules/integrations/mcp"
import { parsePlatformAdminConfig } from "@modules/domain/platform-admin"
import { parseWorkspaceInvitesConfig } from "@modules/domain/workspace-invites"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
import { parseDocumentsConfig } from "@modules/integrations/documents"
import { parseAiGatewayConfig } from "@modules/integrations/ai-gateway"
import { parseAiConfig } from "@modules/integrations/ai"
import { parseN8nConfig } from "@modules/integrations/n8n"
import { parseAiTasksConfig } from "@modules/domain/ai-tasks"
import { parseAgentTurnsConfig } from "@modules/domain/agent-turns"
import { parseOpenclawConfig } from "@modules/integrations/openclaw"
import { parseVideoConfig } from "@modules/domain/video"
import { parseFfmpegConfig } from "@modules/integrations/ffmpeg"
import { parseObjectStorageConfig } from "@modules/integrations/object-storage"
import { parseIdentityAuthConfig } from "@modules/domain/identity"
import { parsePassportConfig } from "@modules/integrations/passport"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseWebhookConnectionsConfig } from "@modules/domain/webhook-connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseGoogleConfig } from "@modules/integrations/google"
import { parseMetaConfig } from "@modules/integrations/meta"
import { parseWebhookDeliveryConfig } from "@modules/integrations/webhook-delivery"
import { parseTtsConfig } from "@modules/integrations/tts"

/** Everything the API needs from its environment, parsed once by `api.env.ts` and handed to `AppModule.register`. */
export interface ApiOptions {
    /** The HTTP listener. */
    readonly server: ReturnType<typeof parseServerConfig>
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The least-privilege PostgreSQL connection. */
    readonly database: ReturnType<typeof parsePrimaryDatabaseConfig>
    /** The S3 object store (MinIO) files live in. */
    readonly storage: ReturnType<typeof parseObjectStorageConfig>
    /** The AI pool: the upstream key, the profiles over it and the in-process gateway. */
    readonly aiGateway: ReturnType<typeof parseAiGatewayConfig>
    /** Our own access-token keys and the Google sign-in client. */
    readonly passport: ReturnType<typeof parsePassportConfig>
    /** The web origin, cookie domain and lifetimes of sign-in. */
    readonly identityAuth: ReturnType<typeof parseIdentityAuthConfig>
    /** The Google Drive reader and the readers of office files and PDFs. */
    readonly documents: ReturnType<typeof parseDocumentsConfig>
    /** Whether a person with no workspace may create a free one. */
    readonly workspaces: ReturnType<typeof parseWorkspacesConfig>
    /** Invitation links and how long they stay valid. */
    readonly workspaceInvites: ReturnType<typeof parseWorkspaceInvitesConfig>
    /** The payment feeds: keys, bank account and the credential key. */
    readonly billing: ReturnType<typeof parseBillingConfig>
    /** The OpenClaw gateway and the agent workspaces. */
    readonly openclaw: ReturnType<typeof parseOpenclawConfig>
    /** The secret that signs the calls of the OpenClaw bridge plugin. */
    readonly agentTurns: ReturnType<typeof parseAgentTurnsConfig>
    /** The prompt library tunables and the AI endpoint it calls. */
    readonly aiTasks: ReturnType<typeof parseAiTasksConfig>
    /** The key that seals the credentials of the connections. */
    readonly connectionSecrets: ReturnType<typeof parseConnectionSecretsConfig>
    /** The dedicated secret mixed into loyalty one-time code hashes. */
    readonly loyaltyOtps: ReturnType<typeof parseLoyaltyOtpsConfig>
    /** The public origin of the web app, for provider return addresses. */
    readonly channels: ReturnType<typeof parseChannelsConfig>
    /** The Telegram Bot API host. */
    readonly telegram: ReturnType<typeof parseTelegramConfig>
    /** The Zalo OAuth and Open API hosts. */
    readonly zalo: ReturnType<typeof parseZaloConfig>
    /** The MCP gateway: the credential NAMES remote connectors may use (each read through <NAME>_FILE) and the call limit. */
    readonly mcpGateway: ReturnType<typeof parseMcpGatewayConfig>
    /** Outgoing mail: the platform sender and the private-host policy. */
    readonly mail: ReturnType<typeof parseMailConfig>
    /** The private-host policy for the owner's systems the data hub reads. */
    readonly dataSources: ReturnType<typeof parseDataSourcesConfig>
    /** The personal Telegram app used for account login and read-only chat sync. */
    readonly telegramUser: ReturnType<typeof parseTelegramUserConfig>
    /** The platform team that may use the console. */
    readonly platformAdmin: ReturnType<typeof parsePlatformAdminConfig>
    /** Which realtime hub the app runs: Redis while Redis is declared, else Postgres; the in-process hub is for tests and one replica. */
    readonly realtime: ReturnType<typeof parseRealtimeConfig>
    /** How the BullMQ workers and the outbox relay run. */
    readonly queue: ReturnType<typeof parseQueueConfig>
    /** Who this worker is and how long a job claim lasts. */
    readonly jobs: ReturnType<typeof parseJobsConfig>
    /** The independent monitor of failed jobs and stale queued work. */
    readonly jobsAlert: ReturnType<typeof parseJobsAlertConfig>
    /** The channel token key that seals provider credentials, and the public site address; the ports are bound by `compose/connections.ts`. */
    readonly connections: ReturnType<typeof parseConnectionsConfig>
    /** The signing key behind outgoing webhooks. */
    readonly webhookConnections: ReturnType<typeof parseWebhookConnectionsConfig>
    /** Google OAuth and Sheets. */
    readonly google: ReturnType<typeof parseGoogleConfig>
    /** Meta (Facebook Pages and Instagram). */
    readonly meta: ReturnType<typeof parseMetaConfig>
    /** The provider calls a connection wizard makes while connecting a channel. */
    readonly channelSetup: ReturnType<typeof parseChannelSetupConfig>
    /** Deliveries to tenant-supplied webhook addresses. */
    readonly webhookDelivery: ReturnType<typeof parseWebhookDeliveryConfig>
    /** The signing secret and the webhook base of the shared n8n workflows. */
    readonly n8n: ReturnType<typeof parseN8nConfig>
    /** The knowledge capability: the demo pacing knob of indexing (`KNOWLEDGE_INDEX_CHUNK_DELAY_MS`, 0 unless a demo asks). */
    readonly knowledge: ReturnType<typeof parseKnowledgeConfig>
    /** How ffmpeg is run. */
    readonly ffmpeg: ReturnType<typeof parseFfmpegConfig>
    /** The text-to-speech provider of the video voiceover. */
    readonly tts: ReturnType<typeof parseTtsConfig>
    /** Where the video renderer finds its assets and how it runs ffmpeg. */
    readonly video: ReturnType<typeof parseVideoConfig>
}

/** Reads the API environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readApiEnv = (env: EnvSource): ApiOptions => ({
    server: parseServerConfig(env),
    httpSecurity: { ...parseHttpSecurityConfig(env), webhooks: {} },
    database: parsePrimaryDatabaseConfig(env),
    storage: parseObjectStorageConfig(env),
    aiGateway: parseAiGatewayConfig(env),
    passport: parsePassportConfig(env),
    identityAuth: parseIdentityAuthConfig(env),
    documents: parseDocumentsConfig(env),
    platformAdmin: parsePlatformAdminConfig(env),
    workspaces: parseWorkspacesConfig(env),
    workspaceInvites: parseWorkspaceInvitesConfig(env),
    billing: parseBillingConfig(env),
    openclaw: parseOpenclawConfig(env),
    agentTurns: parseAgentTurnsConfig(env),
    aiTasks: parseAiTasksConfig(env, parseAiConfig(env)),
    connectionSecrets: parseConnectionSecretsConfig(env),
    loyaltyOtps: parseLoyaltyOtpsConfig(env),
    channels: parseChannelsConfig(env),
    telegram: parseTelegramConfig(env),
    zalo: parseZaloConfig(env),
    mcpGateway: parseMcpGatewayConfig(env, parseMcpConfig(env)),
    mail: parseMailConfig(env),
    dataSources: parseDataSourcesConfig(env),
    telegramUser: parseTelegramUserConfig(env),
    realtime: parseRealtimeConfig(env),
    queue: parseQueueConfig(env),
    jobs: parseJobsConfig(env),
    jobsAlert: parseJobsAlertConfig(env),
    connections: parseConnectionsConfig(env),
    webhookConnections: parseWebhookConnectionsConfig(env),
    google: parseGoogleConfig(env),
    meta: parseMetaConfig(env),
    channelSetup: parseChannelSetupConfig(env),
    webhookDelivery: parseWebhookDeliveryConfig(env),
    n8n: parseN8nConfig(env),
    knowledge: parseKnowledgeConfig(env),
    ffmpeg: parseFfmpegConfig(env),
    tts: parseTtsConfig(env),
    video: parseVideoConfig(env),
})
