import { mock } from "@starci/jest-preset"
import type { AutomationsOverview, AutomationsService } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { GetAutomationsHandler } from "./get-automations.handler"
import { GetAutomationsQuery } from "./get-automations.query"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const MESSAGE = new GetAutomationsQuery({ principal: PRINCIPAL, request: { workspaceId: "ws-1" } })
const OVERVIEW: AutomationsOverview = {
    cards: [],
    runs: [],
    shop: { shop: "Flower Shop", hours: "08:00 - 21:00", tone: "friendly" },
    sample: { variables: { ten_khach: "An" }, neutral: { ten_khach: "customer" } },
}

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new GetAutomationsHandler(logger, automations), automations, logger }
}

describe("GetAutomationsHandler", () => {
    it("returns the overview for the verified member and workspace", async () => {
        const { handler, automations, logger } = build()
        automations.overview.mockResolvedValue(OVERVIEW)

        await expect(handler.execute(MESSAGE)).resolves.toBe(OVERVIEW)

        expect(automations.overview).toHaveBeenCalledTimes(1)
        expect(automations.overview).toHaveBeenCalledWith("u-1", "ws-1")
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows an overview failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("overview unavailable")
        automations.overview.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.overview).toHaveBeenCalledWith("u-1", "ws-1")
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "GetAutomationsHandler",
        })
    })
})
