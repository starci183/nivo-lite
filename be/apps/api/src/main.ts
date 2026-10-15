import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { RequestValidationService, securityHeadersMiddleware } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { DomainError } from "@modules/platform/errors"
import { AppModule } from "./app.module"
import { readApiEnv } from "./api.env"

/** The largest JSON body: a ten megabyte file the browser sends as base64 inside a GraphQL mutation (the data import wizards). */
const JSON_BODY_LIMIT = "14mb"

/** Reads the environment once, composes the API from parsed options and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const env = EnvSource.fromProcess()
    const options = readApiEnv(env)
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(options), { rawBody: true })
    app.set("trust proxy", options.httpSecurity.trustedProxyHops)
    app.disable("x-powered-by")
    app.use(securityHeadersMiddleware())
    app.useBodyParser("json", { limit: JSON_BODY_LIMIT })
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
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, {
        service: "api",
        ...(error instanceof DomainError && typeof error.params.key === "string"
            ? { configField: error.params.key }
            : {}),
    })
    process.exitCode = 1
})
