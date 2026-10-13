import { mock } from "@starci/jest-preset"
import type { AutomationsService } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { RunNowCommand } from "./run-now.command"
import { RunNowHandler } from "./run-now.handler"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const MESSAGE = new RunNowCommand({
    principal: PRINCIPAL,
    request: { workspaceId: "ws-1", templateKey: "email-daily-report" },
})

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new RunNowHandler(logger, automations), automations, logger }
}

describe("RunNowHandler", () => {
    it("runs the requested template for the verified member and workspace", async () => {
        const { handler, automations, logger } = build()
        automations.runNow.mockResolvedValue()

        await expect(handler.execute(MESSAGE)).resolves.toBeUndefined()

        expect(automations.runNow).toHaveBeenCalledTimes(1)
        expect(automations.runNow).toHaveBeenCalledWith("u-1", "ws-1", "email-daily-report")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows a run failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("run unavailable")
        automations.runNow.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.runNow).toHaveBeenCalledWith("u-1", "ws-1", "email-daily-report")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, { operation: "RunNowHandler" })
    })
})
