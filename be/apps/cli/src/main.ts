import "reflect-metadata"
import { CommandFactory } from "nest-commander"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { createCliFailureHandlers, createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { AppModule } from "./app.module"
import { readCliEnv } from "./cli.env"

/** The command line of the back end: reads the environment once and runs the command its arguments name (`cli migrate run`). */
async function bootstrap(): Promise<void> {
    const logger = createJsonLogger(new SystemClockService())
    await CommandFactory.run(AppModule.register(readCliEnv(EnvSource.fromProcess())), {
        logger: false,
        ...createCliFailureHandlers(logger),
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, error, { service: "cli" })
    process.exitCode = 1
})
