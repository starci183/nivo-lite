import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ShipmentEventPayload } from "@modules/queues/automation"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationTickService } from "./automation-tick.service"
import { AutomationsService } from "./automations.service"

const SHIPMENT: ShipmentEventPayload = {
    kind: "shipment",
    workspaceId: "ws-1",
    userId: "user-1",
    orderId: "o-1",
    orderNo: "SO-1",
    leadId: "l-1",
    carrier: "GHN",
    trackingCode: "GHN123",
    shippedAt: "2026-10-12T10:00:00.000Z",
}

const build = async () => {
    const engine = mock<AutomationEngineService>({
        tickNow: jest.fn(() => Promise.resolve({ pipelines: 0, runs: 0 })),
    })
    const automations = mock<AutomationsService>({ emit: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationTickService,
            { provide: AutomationEngineService, useValue: engine },
            { provide: AutomationsService, useValue: automations },
        ],
    }).compile()
    return { tick: moduleRef.get(AutomationTickService), engine, automations }
}

describe("AutomationTickService", () => {
    it("emits a recorded shipment as the order.shipped event of its workspace, deduplicated by order", async () => {
        const { tick, engine, automations } = await build()

        await expect(tick.run(SHIPMENT)).resolves.toBeUndefined()

        expect(automations.emit.mock.calls).toEqual([
            [
                "user-1",
                "ws-1",
                {
                    event: "order.shipped",
                    dedupe: "order.shipped:o-1",
                    data: {
                        order_id: "o-1",
                        order_no: "SO-1",
                        lead_id: "l-1",
                        carrier: "GHN",
                        tracking_code: "GHN123",
                        shipped_at: "2026-10-12T10:00:00.000Z",
                    },
                },
            ],
        ])
        expect(engine.tickNow).not.toHaveBeenCalled()
    })

    it("runs the scheduled engine pass for the scheduler's empty payload", async () => {
        const { tick, engine, automations } = await build()

        await expect(tick.run({})).resolves.toBeUndefined()

        expect(engine.tickNow).toHaveBeenCalledTimes(1)
        expect(automations.emit).not.toHaveBeenCalled()
    })

    it("treats an incomplete shipment as a scheduler tick", async () => {
        const { tick, engine, automations } = await build()

        await tick.run({ ...SHIPMENT, trackingCode: 7 })

        expect(engine.tickNow.mock.calls).toEqual([[]])
        expect(automations.emit).not.toHaveBeenCalled()
    })
})
