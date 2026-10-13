import { mock } from "@starci/jest-preset"
import type { AutomationsService, BodyProposal } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { ProposeBodyCommand } from "./propose-body.command"
import { ProposeBodyHandler } from "./propose-body.handler"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const MESSAGE = new ProposeBodyCommand({
    principal: PRINCIPAL,
    request: { workspaceId: "ws-1", templateKey: "thank_payment" },
})
const PROPOSAL: BodyProposal = { body: "Thank you, {ten_khach}", generated: true, contextVersion: 3 }

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new ProposeBodyHandler(logger, automations), automations, logger }
}

describe("ProposeBodyHandler", () => {
    it("returns a body proposal for the verified member and requested template", async () => {
        const { handler, automations, logger } = build()
        automations.proposeBody.mockResolvedValue(PROPOSAL)

        await expect(handler.execute(MESSAGE)).resolves.toBe(PROPOSAL)

        expect(automations.proposeBody).toHaveBeenCalledTimes(1)
        expect(automations.proposeBody).toHaveBeenCalledWith("u-1", "ws-1", "thank_payment")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows a proposal failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("proposal unavailable")
        automations.proposeBody.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.proposeBody).toHaveBeenCalledWith("u-1", "ws-1", "thank_payment")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, { operation: "ProposeBodyHandler" })
    })
})
