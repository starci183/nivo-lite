import { parseBillingConfig } from "@modules/domain/billing"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource, parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig, RequestValidationService } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseChannelsConfig } from "@modules/domain/channels"
import { parseConnectionSecretsConfig } from "@modules/domain/connection-secrets"
import { parseMailConfig } from "@modules/integrations/mail"
import { parseTelegramConfig } from "@modules/integrations/telegram"
import { parseZaloConfig } from "@modules/integrations/zalo"
import { parsePlatformAdminConfig } from "@modules/domain/platform-admin"
import { parseWorkspaceInvitesConfig } from "@modules/domain/workspace-invites"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
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
import { AppModule } from "./app.module"
import type { ApiOptions } from "./api.options"

/** Proxy hops in front of the API (the Traefik edge): the rate limit keys on the real client address, not on the proxy. */
const TRUSTED_PROXY_HOPS = 1

/** Reads the environment once, composes the API from parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options: ApiOptions = {
        server: parseServerConfig(env),
        httpSecurity: {
            ...parseHttpSecurityConfig(env),
            // One entry per inbound provider, e.g. stripe: parseWebhookProviderConfig(env, "STRIPE"); lanes register theirs here.
            webhooks: {},
        },
        database: parsePrimaryDatabaseConfig(env),
        supabase: parseSupabaseConfig(env),
        platformAdmin: parsePlatformAdminConfig(env),
        workspaces: parseWorkspacesConfig(env),
        workspaceInvites: parseWorkspaceInvitesConfig(env),
        billing: parseBillingConfig(env),
        openclaw: parseOpenclawConfig(env),
        deepseek: parseDeepseekConfig(env),
        connectionSecrets: parseConnectionSecretsConfig(env),
        channels: parseChannelsConfig(env),
        telegram: parseTelegramConfig(env),
        zalo: parseZaloConfig(env),
        mail: parseMailConfig(env),
        queue: parseQueueConfig(env),
        jobs: parseJobsConfig(env),
        connections: parseConnectionsConfig(env),
        webhookConnections: parseWebhookConnectionsConfig(env),
        google: parseGoogleConfig(env),
        meta: parseMetaConfig(env),
        channelSetup: parseChannelSetupConfig(env),
        webhookDelivery: parseWebhookDeliveryConfig(env),
        ffmpeg: parseFfmpegConfig(env),
        tts: parseTtsConfig(env),
        video: parseVideoConfig(env),
    }
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(options), { rawBody: true })
    app.set("trust proxy", TRUSTED_PROXY_HOPS)
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
    app.useGlobalPipes(app.get(RequestValidationService))
    await app.listen(options.server.port)
    createJsonLogger(new SystemClockService()).info(LoggingLogEvent.ServerStarted, {
        service: "api",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "api" })
    process.exitCode = 1
})
