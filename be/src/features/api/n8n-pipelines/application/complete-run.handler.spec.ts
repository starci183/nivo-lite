import { mock } from "@starci/jest-preset"
import type { N8nCompletion, N8nDoorService } from "@modules/domain/n8n-runs"
import type { Logger } from "@modules/platform/logging"
import { CompleteRunCommand } from "./complete-run.command"
import { CompleteRunHandler } from "./complete-run.handler"

const REPORT: N8nCompletion = { status: "done", summary: "Sent report", result: { sent: 2 } }

const build = () => {
    const logger = mock<Logger>()
    const door = mock<N8nDoorService>()
    const handler = new CompleteRunHandler(logger, door)
    const message = new CompleteRunCommand({
        request: { authorization: "Bearer run-token", runId: "run-1", report: REPORT },
    })
    return { logger, door, handler, message }
}

describe("CompleteRunHandler", () => {
    it("passes the bearer, run id and completion report to the door", async () => {
        const { logger, door, handler, message } = build()
        door.completeRun.mockResolvedValue(undefined)

        await expect(handler.execute(message)).resolves.toBeUndefined()

        expect(door.completeRun).toHaveBeenCalledTimes(1)
        expect(door.completeRun).toHaveBeenCalledWith("Bearer run-token", "run-1", REPORT)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows the door failure", async () => {
        const { logger, door, handler, message } = build()
        const failure = new Error("Run completion failed")
        door.completeRun.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "CompleteRunHandler",
        })
    })
})
