import { parseKnowledgeConfig } from "@modules/domain/knowledge"
import { parseBillingConfig } from "@modules/domain/billing"
import { parseConnectionPollConfig } from "@modules/domain/connection-poll"
import { parseServerConfig, type EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseJobsAlertConfig } from "@modules/domain/job-ops"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseRealtimeConfig } from "@modules/platform/realtime"
import { parseChannelsConfig } from "@modules/domain/channels"
import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseDataSourcesConfig } from "@modules/integrations/data-sources"
import { parseTelegramUserConfig } from "@modules/integrations/telegram-user"
import { parseMailConfig } from "@modules/integrations/mail"
import { parseSepayConfig } from "@modules/integrations/sepay"
import { parseTelegramConfig } from "@modules/integrations/telegram"
import { parseZaloConfig } from "@modules/integrations/zalo"
import { parseZaloProviderConfig } from "@modules/domain/zalo-provider"
import { parseToolsConfig } from "@modules/domain/tools"
import { parsePlatformAdminConfig } from "@modules/domain/platform-admin"
import { parseWorkspaceInvitesConfig } from "@modules/domain/workspace-invites"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
import { parseApiKeysConfig } from "@modules/domain/api-keys"
import { parseDocumentsConfig } from "@modules/integrations/documents"
import { parseAiGatewayConfig } from "@modules/integrations/ai-gateway"
import { parseAiConfig } from "@modules/integrations/ai"
import { parseQdrantConfig } from "@modules/integrations/qdrant"
import { parseRedisConfig } from "@modules/integrations/redis"
import { parseRemoteFilesConfig } from "@modules/integrations/remote-files"
import { parseAiTasksConfig } from "@modules/domain/ai-tasks"
import { parseAgentRunsConfig } from "@modules/domain/agent-runs"
import { parseAgentThreadsConfig } from "@modules/domain/agent-threads"
import { parseAgentLoopConfig } from "@modules/domain/graph-nodes"
import { parseLanggraphConfig } from "@modules/integrations/langgraph"
import { parseEntityEngineConfig } from "@modules/domain/entity-engine"
import { parseObjectStorageConfig } from "@modules/integrations/object-storage"
import { parseIdentityAuthConfig } from "@modules/domain/identity"
import { parsePassportConfig } from "@modules/integrations/passport"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseWebhookConnectionsConfig } from "@modules/domain/webhook-connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseGoogleConfig } from "@modules/integrations/google"
import { parseMetaConfig } from "@modules/integrations/meta"
import { parseWebhookDeliveryConfig } from "@modules/integrations/webhook-delivery"
import { parseInetConfig } from "@modules/integrations/inet"
import { parsePayosConfig } from "@modules/integrations/payos"
import { parseTinoConfig } from "@modules/integrations/tino"
import { parseElevenLabsConfig } from "@modules/integrations/elevenlabs"
import { parseVeoConfig } from "@modules/integrations/veo"
import { parseShotstackConfig } from "@modules/integrations/shotstack"
import { parseCreatomateConfig } from "@modules/integrations/creatomate"
import { parseJson2VideoConfig } from "@modules/integrations/json2video"
import { parseGoogleCalendarConfig } from "@modules/integrations/google-calendar"
import { parseMetaPublishingConfig } from "@modules/integrations/meta-publishing"
import { parseYoutubeConfig } from "@modules/integrations/youtube"
import { parseTiktokConfig } from "@modules/integrations/tiktok"
import { parseMisaAmisConfig } from "@modules/integrations/misa-amis"
import { parseMisaMeinvoiceConfig } from "@modules/integrations/misa-meinvoice"

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
    /** The public base URL of the mcp app an MCP key's endpoint is answered under (`MCP_PUBLIC_URL`, optional). */
    readonly apiKeys: ReturnType<typeof parseApiKeysConfig>
    /** Invitation links and how long they stay valid. */
    readonly workspaceInvites: ReturnType<typeof parseWorkspaceInvitesConfig>
    /** The payment feeds: keys, bank account and the credential key. */
    readonly billing: ReturnType<typeof parseBillingConfig>
    /** The adaptive poll of connections: intervals, jitter, breaker thresholds and the limiter Redis. */
    readonly connectionPoll: ReturnType<typeof parseConnectionPollConfig>
    /** The Redis connections the capabilities that keep state in Redis open. */
    readonly redis: ReturnType<typeof parseRedisConfig>
    /** The limits every read of a remote file is held to: size, deadline and redirects. */
    readonly remoteFiles: ReturnType<typeof parseRemoteFilesConfig>
    /** The running build and how often a parked run is run again. */
    readonly agentRuns?: ReturnType<typeof parseAgentRunsConfig>
    /** The key that signs entity-engine cursors. */ readonly entityEngine: ReturnType<typeof parseEntityEngineConfig>
    /** The prompt library tunables and the AI endpoint it calls. */
    readonly aiTasks: ReturnType<typeof parseAiTasksConfig>
    /** The key that seals the credentials of the connections. */
    readonly connectionSecrets: ReturnType<typeof parseConnectionSecretsConfig>
    /** The public origin of the web app, for provider return addresses. */
    readonly channels: ReturnType<typeof parseChannelsConfig>
    /** The Telegram Bot API host. */
    readonly telegram: ReturnType<typeof parseTelegramConfig>
    /** The SePay user API host. */
    readonly sepay: ReturnType<typeof parseSepayConfig>
    /** The Zalo OAuth and Open API hosts. */
    readonly zalo: ReturnType<typeof parseZaloConfig>
    /** The reply window, the stale age and the backfill window of the Zalo inbox reconcile job. */
    readonly zaloProvider: ReturnType<typeof parseZaloProviderConfig>
    /** The engine tools: the call limit of a tool family that declares none. */
    readonly toolsConfig: ReturnType<typeof parseToolsConfig>
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
    /** The knowledge capability: the demo pacing knob of indexing (`KNOWLEDGE_INDEX_CHUNK_DELAY_MS`, 0 unless a demo asks). */
    readonly knowledge: ReturnType<typeof parseKnowledgeConfig>
    /** The vector index (`QDRANT_URL`, `QDRANT_API_KEY`); without the address vectors stay in Postgres. */
    readonly qdrant: ReturnType<typeof parseQdrantConfig>
    /** iNET's API host and call limit (the domain registrar; the key is per connection, sealed). */
    readonly inet: ReturnType<typeof parseInetConfig>
    /** Tino's API host and call limit (the domain registrar; the token is per connection, sealed). */
    readonly tino: ReturnType<typeof parseTinoConfig>
    /** payOS's API host and call limit (the payment-link provider; the three keys are per connection, sealed). */
    readonly payos: ReturnType<typeof parsePayosConfig>
    /** ElevenLabs' API host and call limits (speech and dubbing; the key is per connection, sealed). */
    readonly elevenlabs: ReturnType<typeof parseElevenLabsConfig>
    /** Veo's API host and call limits (video generation; the key is per connection, sealed). */
    readonly veo: ReturnType<typeof parseVeoConfig>
    /** Shotstack's API host and call limit (cloud video compose; the key and the stage/production choice are per connection). */
    readonly shotstack: ReturnType<typeof parseShotstackConfig>
    /** Creatomate's API host and call limit (cloud video compose; the key is per connection, sealed). */
    readonly creatomate: ReturnType<typeof parseCreatomateConfig>
    /** JSON2Video's API host and call limit (cloud video compose; the key is per connection, sealed). */
    readonly json2video: ReturnType<typeof parseJson2VideoConfig>
    /** Google Calendar's API host and call limit (the calendar tools; the access token is the Google account's). */
    readonly googleCalendar: ReturnType<typeof parseGoogleCalendarConfig>
    /** The Graph API's publishing host and limits (Facebook Page and Instagram posts; the Page token is per connection, sealed). */
    readonly metaPublishing: ReturnType<typeof parseMetaPublishingConfig>
    /** YouTube's API hosts and limits (video upload; the access token is the Google account's). */
    readonly youtube: ReturnType<typeof parseYoutubeConfig>
    /** TikTok's API host, limits and the deployment's app client (video posting; the user tokens are per connection, sealed). */
    readonly tiktok: ReturnType<typeof parseTiktokConfig>
    /** MISA AMIS' call limit (no operation is built: its documentation could not be read). */
    readonly misaAmis: ReturnType<typeof parseMisaAmisConfig>
    /** MISA meInvoice's call limit (no operation is built: its documentation could not be read). */
    readonly misaMeinvoice: ReturnType<typeof parseMisaMeinvoiceConfig>
    /** The bounds of the LangGraph integration; reading them is also the guard that refuses a LangSmith tracing switch at boot. */
    readonly langgraph?: ReturnType<typeof parseLanggraphConfig>
    /** The thread runs' tunables (graphs kept, the stops' deadline windows). */
    readonly agentThreads?: ReturnType<typeof parseAgentThreadsConfig>
    /** The nodes whose agent runs on the prebuilt loop with native tool calling (`AGENT_LOOP=prebuilt:<ids>`); none unless the flag names them. */
    readonly agentLoop?: ReturnType<typeof parseAgentLoopConfig>
}
/**
 * Reads the API environment; missing or invalid values fail boot and secret readers prefer mounted files. The LangGraph options are
 * read first and always, whatever the engine flag says: a tracing switch in the environment stops the boot before anything else.
 */
export const readApiEnv = (env: EnvSource): ApiOptions => ({
    langgraph: parseLanggraphConfig(env),
    agentThreads: parseAgentThreadsConfig(env),
    agentLoop: parseAgentLoopConfig(env),
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
    apiKeys: parseApiKeysConfig(env),
    workspaceInvites: parseWorkspaceInvitesConfig(env),
    billing: parseBillingConfig(env),
    connectionPoll: parseConnectionPollConfig(env),
    redis: parseRedisConfig(env),
    remoteFiles: parseRemoteFilesConfig(env),
    agentRuns: parseAgentRunsConfig(env),
    entityEngine: parseEntityEngineConfig(env),
    aiTasks: parseAiTasksConfig(env, parseAiConfig(env)),
    connectionSecrets: parseConnectionSecretsConfig(env),
    channels: parseChannelsConfig(env),
    telegram: parseTelegramConfig(env),
    sepay: parseSepayConfig(env),
    zalo: parseZaloConfig(env),
    zaloProvider: parseZaloProviderConfig(env),
    toolsConfig: parseToolsConfig(env),
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
    knowledge: parseKnowledgeConfig(env),
    qdrant: parseQdrantConfig(env),
    inet: parseInetConfig(env),
    tino: parseTinoConfig(env),
    payos: parsePayosConfig(env),
    elevenlabs: parseElevenLabsConfig(env),
    veo: parseVeoConfig(env),
    shotstack: parseShotstackConfig(env),
    creatomate: parseCreatomateConfig(env),
    json2video: parseJson2VideoConfig(env),
    googleCalendar: parseGoogleCalendarConfig(env),
    metaPublishing: parseMetaPublishingConfig(env),
    youtube: parseYoutubeConfig(env),
    tiktok: parseTiktokConfig(env),
    misaAmis: parseMisaAmisConfig(env),
    misaMeinvoice: parseMisaMeinvoiceConfig(env),
})
