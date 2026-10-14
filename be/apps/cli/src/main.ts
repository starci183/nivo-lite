import "reflect-metadata"
import { CommandFactory } from "nest-commander"
import { SystemClockService } from "@modules/platform/clock"
import { EnvSource } from "@modules/platform/config"
import { HttpError } from "@modules/platform/http"
import { createJsonLogger, LoggingLogEvent } from "@modules/platform/logging"
import { SepaySimulationHttpError } from "@modules/integrations/sepay-simulation-http"
import { AppModule } from "./app.module"
import { parseCliAppOptions } from "./cli.options"

/** Keeps the native fetch failure the simulated delivery has always printed to the operator. */
const cliErrorOf = (error: unknown): unknown => {
    if (
        error instanceof SepaySimulationHttpError &&
        error.cause instanceof HttpError &&
        error.cause.cause !== undefined
    ) {
        return error.cause.cause
    }
    return error
}

/** The command line of the back end: reads the environment once and runs the command its arguments name (`cli migrate run`). */
async function bootstrap(): Promise<void> {
    const logger = createJsonLogger(new SystemClockService())
    await CommandFactory.run(AppModule.register(parseCliAppOptions(EnvSource.fromProcess())), {
        logger: false,
        errorHandler: (error: Error) => {
            logger.error(LoggingLogEvent.StartupFailed, cliErrorOf(error), { service: "cli" })
            process.exit(1)
        },
    })
}

bootstrap().catch((error: unknown) => {
    createJsonLogger(new SystemClockService()).error(LoggingLogEvent.StartupFailed, cliErrorOf(error), {
        service: "cli",
    })
    process.exit(1)
})
