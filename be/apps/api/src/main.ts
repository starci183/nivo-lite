import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { securityHeaders } from "@modules/platform/http-security"
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
    // The environment parser accepts exactly these proxy topologies; every Express value is a fixed hop count.
    if (options.httpSecurity.trustedProxyHops === 0) app.set("trust proxy", 0)
    else if (options.httpSecurity.trustedProxyHops === 2) app.set("trust proxy", 2)
    else app.set("trust proxy", 1)
    app.disable("x-powered-by")
    app.use(securityHeaders)
    app.useBodyParser("json", { limit: JSON_BODY_LIMIT })
    app.enableCors({ origin: [...options.httpSecurity.allowedOrigins] })
    app.enableShutdownHooks()
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
