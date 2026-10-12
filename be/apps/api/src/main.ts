import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource, parseServerConfig } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig, RequestValidationService } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { parseJobsConfig } from "@modules/platform/jobs"
import { parseQueueConfig } from "@modules/platform/queue"
import { parseWorkspaceInvitesConfig } from "@modules/domain/workspace-invites"
import { parseWorkspacesConfig } from "@modules/domain/workspaces"
import { parseSupabaseConfig } from "@modules/integrations/supabase"
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
        workspaces: parseWorkspacesConfig(env),
        workspaceInvites: parseWorkspaceInvitesConfig(env),
        queue: parseQueueConfig(env),
        jobs: parseJobsConfig(env),
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
