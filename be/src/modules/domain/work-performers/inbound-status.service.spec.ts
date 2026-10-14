import { mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import type { WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { InboundStatusService } from "./inbound-status.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "vi" }

describe("InboundStatusService", () => {
    const build = async () => {
        const events = mock<InboundEventsService>({ mark: jest.fn().mockResolvedValue(undefined) })
        const moduleRef = await Test.createTestingModule({
            providers: [InboundStatusService, { provide: InboundEventsService, useValue: events }],
        }).compile()
        return { status: moduleRef.get(InboundStatusService), events }
    }

    it("marks the inbound event and links the customer", async () => {
        const { status, events } = await build()

        await expect(status.mark(ctx, "evt-1", "processed", "lead-1")).resolves.toBeUndefined()

        expect(events.mark).toHaveBeenCalledWith("ws-1", "evt-1", "processed", "lead-1")
    })

    it("marks the inbound event without a customer", async () => {
        const { status, events } = await build()

        await expect(status.mark(ctx, "evt-1", "failed", null)).resolves.toBeUndefined()

        expect(events.mark).toHaveBeenCalledWith("ws-1", "evt-1", "failed", null)
    })
})
