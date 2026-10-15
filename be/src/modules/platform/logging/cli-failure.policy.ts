import { LoggingLogEvent } from "./logging.log-events"
import type { Logger } from "./logging.port"

/** The error callbacks the cli hands to `CommandFactory.run`; both leave the process with a non-zero exit code. */
export interface CliFailureHandlers {
    /** Commander's own failures (unknown command, missing argument); help and version (exit code 0) stay silent. */
    readonly errorHandler: (error: Error) => void
    /** A command that threw or rejected. */
    readonly serviceErrorHandler: (error: Error) => void
}

/** Commander's error carries the exit code it wants; any other error is a plain failure. */
const exitCodeOf = (error: Error): number => {
    const code: unknown = Reflect.get(error, "exitCode")
    return typeof code === "number" ? code : 1
}

/**
 * Builds the cli failure handlers: one structured error line (error name and message, redacted by the logger, never the environment)
 * and `process.exitCode` set rather than a hard exit, so the line is flushed before the process ends.
 */
export const createCliFailureHandlers = (logger: Logger): CliFailureHandlers => ({
    errorHandler: (error) => {
        const exitCode = exitCodeOf(error)
        if (exitCode === 0) {
            return
        }
        logger.error(LoggingLogEvent.CommandFailed, error, { service: "cli" })
        process.exitCode = exitCode
    },
    serviceErrorHandler: (error) => {
        logger.error(LoggingLogEvent.CommandFailed, error, { service: "cli" })
        process.exitCode = 1
    },
})
