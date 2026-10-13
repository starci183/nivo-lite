import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ShipmentEventPayload } from "@modules/queues/automation"
import { AutomationEngineService } from "./automation-engine.service"
import { AutomationTickService } from "./automation-tick.service"
import { AutomationsService } from "./automations.service"
import type { TickResult } from "./automations.contracts"

const TICK: TickResult = { pipelines: 2, runs: 1 }

const SHIPMENT: ShipmentEventPayload = {
    kind: "shipment",
    workspaceId: "ws-1",
    userId: "user-1",
    orderId: "order-1",
    orderNo: "NO-1",
    leadId: "lead-1",
    carrier: "ghn",
    trackingCode: "TRACK-1",
    shippedAt: "2026-10-12T10:00:00.000Z",
}

const build = async () => {
    const engine = mock<AutomationEngineService>()
    engine.tickNow.mockResolvedValue(TICK)
    const automations = mock<AutomationsService>()
    automations.emit.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            AutomationTickService,
            { provide: AutomationEngineService, useValue: engine },
            { provide: AutomationsService, useValue: automations },
        ],
    }).compile()
    return { service: moduleRef.get(AutomationTickService), engine, automations }
}

describe("AutomationTickService", () => {
    it("emits a shipped order and does not run the minute tick", async () => {
        const { service, automations, engine } = await build()

        await expect(service.run(SHIPMENT)).resolves.toBeUndefined()

        expect(automations.emit).toHaveBeenCalledWith("user-1", "ws-1", {
            event: "order.shipped",
            dedupe: "order.shipped:order-1",
            data: {
                order_id: "order-1",
                order_no: "NO-1",
                lead_id: "lead-1",
                carrier: "ghn",
                tracking_code: "TRACK-1",
                shipped_at: "2026-10-12T10:00:00.000Z",
            },
        })
        expect(engine.tickNow).not.toHaveBeenCalled()
    })

    it("emits a shipment that has no customer", async () => {
        const { service, automations } = await build()

        await expect(service.run({ ...SHIPMENT, leadId: null })).resolves.toBeUndefined()

        expect(automations.emit).toHaveBeenCalledWith("user-1", "ws-1", {
            event: "order.shipped",
            dedupe: "order.shipped:order-1",
            data: {
                order_id: "order-1",
                order_no: "NO-1",
                lead_id: null,
                carrier: "ghn",
                tracking_code: "TRACK-1",
                shipped_at: "2026-10-12T10:00:00.000Z",
            },
        })
    })

    it("runs the engine tick for a scheduler payload", async () => {
        const { service, engine, automations } = await build()

        await expect(service.run({ workspaceId: "ws-1" })).resolves.toBeUndefined()

        expect(engine.tickNow).toHaveBeenCalledTimes(1)
        expect(automations.emit).not.toHaveBeenCalled()
    })
})
