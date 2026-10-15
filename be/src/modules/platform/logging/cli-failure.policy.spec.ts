import { mock } from "@starci/jest-preset"
import { createCliFailureHandlers } from "./cli-failure.policy"
import { LoggingLogEvent } from "./logging.log-events"
import type { Logger } from "./logging.port"

describe("createCliFailureHandlers", () => {
    const original = process.exitCode

    beforeEach(() => {
        process.exitCode = undefined
    })

    afterEach(() => {
        process.exitCode = original
    })

    it("logs one error line and exits non-zero when a command throws", () => {
        const logger = mock<Logger>()
        const failure = new Error("ENOENT: no such file")

        createCliFailureHandlers(logger).serviceErrorHandler(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith(LoggingLogEvent.CommandFailed, failure, { service: "cli" })
        expect(process.exitCode).toBe(1)
    })

    it("fails a commander error with the exit code commander asks for", () => {
        const logger = mock<Logger>()

        createCliFailureHandlers(logger).errorHandler(Object.assign(new Error("unknown command"), { exitCode: 2 }))

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(process.exitCode).toBe(2)
    })

    it("fails a commander error without an exit code as 1", () => {
        const logger = mock<Logger>()

        createCliFailureHandlers(logger).errorHandler(new Error("boom"))

        expect(process.exitCode).toBe(1)
    })

    it("stays silent for help and version, which commander ends with exit code 0", () => {
        const logger = mock<Logger>()

        createCliFailureHandlers(logger).errorHandler(Object.assign(new Error("(outputHelp)"), { exitCode: 0 }))

        expect(logger.error).not.toHaveBeenCalled()
        expect(process.exitCode).toBeUndefined()
    })
})
