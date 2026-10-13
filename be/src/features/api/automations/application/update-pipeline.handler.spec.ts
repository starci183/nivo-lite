import { mock } from "@starci/jest-preset"
import type { AutomationCard, AutomationsService, PipelinePatch } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { buildTemplate } from "@tests/fixtures/builders/automations.builder"
import { UpdatePipelineCommand } from "./update-pipeline.command"
import { UpdatePipelineHandler } from "./update-pipeline.handler"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const PATCH: PipelinePatch = {
    enabled: true,
    dismissed: false,
    values: { days: 3 },
    body: "Thank you, {ten_khach}",
    autoSend: false,
    googleConnectionId: "g-1",
}
const MESSAGE = new UpdatePipelineCommand({
    principal: PRINCIPAL,
    request: { workspaceId: "ws-1", templateKey: "thank_payment", patch: PATCH },
})
const CARD: AutomationCard = {
    key: "thank_payment",
    def: buildTemplate(),
    pipelineId: "p-1",
    enabled: true,
    dismissed: false,
    config: { days: 3 },
    body: "Thank you, {ten_khach}",
    bodyVersion: 1,
    basedOnContext: 3,
    currentContext: 3,
    bodyStale: false,
    gate: "ask",
    missing: [],
    proposed: true,
    comingSoon: false,
    lastRunAt: null,
    runCount: 0,
    trust: { streak: 0, offered: false, autoSend: false },
}

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new UpdatePipelineHandler(logger, automations), automations, logger }
}

describe("UpdatePipelineHandler", () => {
    it("returns the updated card after forwarding the complete patch", async () => {
        const { handler, automations, logger } = build()
        automations.update.mockResolvedValue(CARD)

        await expect(handler.execute(MESSAGE)).resolves.toBe(CARD)

        expect(automations.update).toHaveBeenCalledTimes(1)
        expect(automations.update).toHaveBeenCalledWith("u-1", "ws-1", "thank_payment", PATCH)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows an update failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("update unavailable")
        automations.update.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.update).toHaveBeenCalledWith("u-1", "ws-1", "thank_payment", PATCH)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "UpdatePipelineHandler",
        })
    })
})
