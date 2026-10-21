import "reflect-metadata"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { securityHeaders } from "@modules/platform/http-security"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readMcpEnv } from "./mcp.env"

/** The largest JSON-RPC body an agent may send. */
const JSON_BODY_LIMIT = "1mb"

/** Reads the environment once, composes the gateway app and serves until a shutdown signal. */
const bootstrap = async (): Promise<void> => {
    const options = readMcpEnv(EnvSource.fromProcess())
    const app = await NestFactory.create<NestExpressApplication>(AppModule.register(options))
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
        service: "mcp",
        port: options.server.port,
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "mcp" })
    process.exitCode = 1
})
