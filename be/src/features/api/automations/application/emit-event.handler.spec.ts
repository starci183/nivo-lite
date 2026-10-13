import { mock } from "@starci/jest-preset"
import type { AutomationsService, BusinessEventInput } from "@modules/domain/automations"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { EmitEventCommand } from "./emit-event.command"
import { EmitEventHandler } from "./emit-event.handler"

const PRINCIPAL: Principal = { id: "u-1", email: "owner@example.com", role: "authenticated" }
const EVENT: BusinessEventInput = {
    event: "payment.received",
    dedupe: "invoice:i-1",
    data: { invoice_id: "i-1", amount_vnd: 350000 },
}
const MESSAGE = new EmitEventCommand({ principal: PRINCIPAL, request: { workspaceId: "ws-1", event: EVENT } })

const build = () => {
    const logger = mock<Logger>()
    const automations = mock<AutomationsService>()
    return { handler: new EmitEventHandler(logger, automations), automations, logger }
}

describe("EmitEventHandler", () => {
    it("emits the event for the verified member and workspace", async () => {
        const { handler, automations, logger } = build()
        automations.emit.mockResolvedValue()

        await expect(handler.execute(MESSAGE)).resolves.toBeUndefined()

        expect(automations.emit).toHaveBeenCalledTimes(1)
        expect(automations.emit).toHaveBeenCalledWith("u-1", "ws-1", EVENT)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows an event failure", async () => {
        const { handler, automations, logger } = build()
        const failure = new Error("engine unavailable")
        automations.emit.mockRejectedValue(failure)

        await expect(handler.execute(MESSAGE)).rejects.toBe(failure)

        expect(automations.emit).toHaveBeenCalledWith("u-1", "ws-1", EVENT)
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, { operation: "EmitEventHandler" })
    })
})
