import { parseBillingConfig } from "@modules/domain/billing"
import type { EnvSource } from "@modules/platform/config"
import { parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseJobsAlertConfig } from "@modules/domain/job-ops"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseChannelsConfig } from "@modules/domain/channels"
import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseLoyaltyOtpsConfig } from "@modules/domain/loyalty-otps"
import { parseDataSourcesConfig } from "@modules/integrations/data-sources"
import { parseTelegramUserConfig } from "@modules/integrations/telegram-user"
import { parseMailConfig } from "@modules/integrations/mail"
import { parseTelegramConfig } from "@modules/integrations/telegram"
import { parseZaloConfig } from "@modules/integrations/zalo"
import { parsePlatformAdminConfig } from "@modules/domain/platform-admin"
import { parseWorkspaceInvitesConfig } from "@modules/domain/workspace-invites"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
import { parseDocumentsConfig } from "@modules/integrations/documents"
import { parseLlmConfig } from "@modules/integrations/llm"
import { parseN8nConfig } from "@modules/integrations/n8n"
import { parseDeepseekConfig } from "@modules/integrations/deepseek"
import { parseOpenclawConfig } from "@modules/integrations/openclaw"
import { parseVideoConfig } from "@modules/domain/video"
import { parseFfmpegConfig } from "@modules/integrations/ffmpeg"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
import { parseConnectionsConfig } from "@modules/domain/connections"
import { parseWebhookConnectionsConfig } from "@modules/domain/webhook-connections"
import { parseChannelSetupConfig } from "@modules/integrations/channel-setup"
import { parseGoogleConfig } from "@modules/integrations/google"
import { parseMetaConfig } from "@modules/integrations/meta"
import { parseWebhookDeliveryConfig } from "@modules/integrations/webhook-delivery"
import { parseTtsConfig } from "@modules/integrations/tts"
import type { ApiOptions } from "./api.options"

/** Reads the API environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readApiEnv = (env: EnvSource): ApiOptions => ({
    server: parseServerConfig(env),
    httpSecurity: {
        ...parseHttpSecurityConfig(env),
        // One entry per inbound provider, e.g. stripe: parseWebhookProviderConfig(env, "STRIPE"); lanes register theirs here.
        webhooks: {},
    },
    database: parsePrimaryDatabaseConfig(env),
    supabase: parseSupabaseConfig(env),
    llm: parseLlmConfig(env),
    documents: parseDocumentsConfig(env),
    platformAdmin: parsePlatformAdminConfig(env),
    workspaces: parseWorkspacesConfig(env),
    workspaceInvites: parseWorkspaceInvitesConfig(env),
    billing: parseBillingConfig(env),
    openclaw: parseOpenclawConfig(env),
    deepseek: parseDeepseekConfig(env),
    connectionSecrets: parseConnectionSecretsConfig(env),
    loyaltyOtps: parseLoyaltyOtpsConfig(env),
    channels: parseChannelsConfig(env),
    telegram: parseTelegramConfig(env),
    zalo: parseZaloConfig(env),
    mail: parseMailConfig(env),
    dataSources: parseDataSourcesConfig(env),
    telegramUser: parseTelegramUserConfig(env),
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
    ffmpeg: parseFfmpegConfig(env),
    tts: parseTtsConfig(env),
    video: parseVideoConfig(env),
})
