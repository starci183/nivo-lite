import { mock } from "@starci/jest-preset"
import type { AutomationsService } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import type { SuggestAutomationsResult } from "./suggest-automations.contracts"
import { SuggestAutomationsHandler } from "./suggest-automations.handler"
import { SuggestAutomationsQuery } from "./suggest-automations.query"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const SUGGESTIONS: SuggestAutomationsResult = [
    {
        key: "thank_payment",
        name: { vi: "Cam on thanh toan", en: "Thank a payment" },
        reason: { vi: "Cham soc khach hang", en: "Follow up with customers" },
    },
]

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new SuggestAutomationsHandler(logger, automations), automations, logger }
}

describe("SuggestAutomationsHandler", () => {
    it.each(["sales", ""])("returns suggestions with module filter '%s'", async (moduleKey) => {
        const { handler, automations, logger } = build()
        const message = new SuggestAutomationsQuery({ principal: PRINCIPAL, request: { workspaceId: "ws-1", moduleKey } })
        automations.suggestFor.mockResolvedValue(SUGGESTIONS)

        await expect(handler.execute(message)).resolves.toBe(SUGGESTIONS)

        expect(automations.suggestFor).toHaveBeenCalledTimes(1)
        expect(automations.suggestFor).toHaveBeenCalledWith("u-1", "ws-1", moduleKey)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows a suggestion failure", async () => {
        const { handler, automations, logger } = build()
        const message = new SuggestAutomationsQuery({
            principal: PRINCIPAL,
            request: { workspaceId: "ws-1", moduleKey: "sales" },
        })
        const failure = new Error("suggestions unavailable")
        automations.suggestFor.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(automations.suggestFor).toHaveBeenCalledWith("u-1", "ws-1", "sales")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "SuggestAutomationsHandler",
        })
    })
})
