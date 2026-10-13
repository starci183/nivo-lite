import { mock } from "@starci/jest-preset"
import type { AutomationsService } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { ListRunsResult } from "./list-runs.contracts"
import { ListRunsHandler } from "./list-runs.handler"
import { ListRunsQuery } from "./list-runs.query"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const RUNS: ListRunsResult = [
    {
        id: "r-1",
        pipelineId: "p-1",
        templateKey: "thank_payment",
        status: "done",
        triggerRef: "payment:i-1",
        summary: "Payment thanked",
        steps: [{ label: "Send thank you", status: "done", detail: "Sent to An" }],
        evidence: "invoice:i-1",
        error: null,
        createdAt: "2026-10-12T10:00:00.000Z",
        finishedAt: "2026-10-12T10:00:01.000Z",
        workItemId: null,
        message: "Thank you, An",
    },
]

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new ListRunsHandler(logger, automations), automations, logger }
}

describe("ListRunsHandler", () => {
    it.each(["thank_payment", ""])("returns history with template filter '%s'", async (templateKey) => {
        const { handler, automations, logger } = build()
        const message = new ListRunsQuery({ principal: PRINCIPAL, request: { workspaceId: "ws-1", templateKey } })
        automations.history.mockResolvedValue(RUNS)

        await expect(handler.execute(message)).resolves.toBe(RUNS)

        expect(automations.history).toHaveBeenCalledTimes(1)
        expect(automations.history).toHaveBeenCalledWith("u-1", "ws-1", templateKey)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows a history failure", async () => {
        const { handler, automations, logger } = build()
        const message = new ListRunsQuery({
            principal: PRINCIPAL,
            request: { workspaceId: "ws-1", templateKey: "thank_payment" },
        })
        const failure = new Error("history unavailable")
        automations.history.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(automations.history).toHaveBeenCalledWith("u-1", "ws-1", "thank_payment")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, { operation: "ListRunsHandler" })
    })
})
