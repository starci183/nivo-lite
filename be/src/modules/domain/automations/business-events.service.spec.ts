import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationsLogEvent } from "./automations.log-events"
import { BusinessEventsService } from "./business-events.service"

const lead = {
    id: "lead-1",
    contact_name: "Lan",
    company: "Hue Tea",
    channel: "Facebook Messenger",
    need: "50 tea boxes",
    phone: "84901234567",
    email: null,
}

describe("BusinessEventsService", () => {
    const build = async () => {
        const engine = mock<AutomationEngineService>()
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                BusinessEventsService,
                { provide: AutomationEngineService, useValue: engine },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { events: moduleRef.get(BusinessEventsService), engine, logger }
    }

    it("hands an announced event to the engine with a copy of its data", async () => {
        const { events, engine } = await build()

        await events.announce("ws-1", { event: "deal.won", dedupe: "deal.won:lead-1", data: { lead_id: "lead-1" } })

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "deal.won",
            dedupe: "deal.won:lead-1",
            data: { lead_id: "lead-1" },
        })
    })

    it("announces a new lead once per lead", async () => {
        const { events, engine } = await build()

        await events.leadCreated("ws-1", lead)

        expect(engine.onBusinessEvent).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            event: "lead.created",
            dedupe: "lead.created:lead-1",
            data: {
                lead_id: "lead-1",
                name: "Lan",
                company: "Hue Tea",
                channel: "Facebook Messenger",
                need: "50 tea boxes",
                phone: "84901234567",
                email: null,
            },
        })
    })

    it("logs a failed announcement and never fails the write it follows", async () => {
        const { events, engine, logger } = await build()
        const cause = new Error("pipelines unreadable")
        engine.onBusinessEvent.mockRejectedValue(cause)

        await expect(events.leadCreated("ws-1", lead)).resolves.toBeUndefined()

        expect(logger.error).toHaveBeenCalledWith(AutomationsLogEvent.AnnounceFailed, cause, {
            workspaceId: "ws-1",
            event: "lead.created",
        })
    })
})
