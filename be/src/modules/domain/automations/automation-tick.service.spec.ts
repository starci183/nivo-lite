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
    const engine = mock<AutomationEngineService>()
    engine.onBusinessEvent.mockResolvedValue(undefined)
    engine.startPaymentReceipt.mockResolvedValue(undefined)
    engine.tickNow.mockResolvedValue({ pipelines: 0, runs: 0 })
    const automations = mock<AutomationsService>()
    automations.emit.mockResolvedValue(undefined)
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

    it("hands a queued business event to the engine under its name", async () => {
        const { tick, engine } = await build()
        const data = { work_item_id: "wi-1", outcome: "rejected" }

        await expect(
            tick.run({
                kind: "business_event",
                event: "decision.made",
                workspaceId: "ws-1",
                dedupe: "decision.made:wi-1:rejected",
                data,
            }),
        ).resolves.toBeUndefined()

        expect(engine.onBusinessEvent.mock.calls).toEqual([
            [{ workspaceId: "ws-1", event: "decision.made", dedupe: "decision.made:wi-1:rejected", data }],
        ])
        expect(engine.tickNow.mock.calls).toEqual([])
    })

    it("starts the receipt pipeline for a queued payment receipt", async () => {
        const { tick, engine } = await build()

        await tick.run({ kind: "payment_receipt", workspaceId: "ws-1", transactionId: "tx-1", invoiceId: null })

        expect(engine.startPaymentReceipt.mock.calls).toEqual([["ws-1", "tx-1", null]])
    })
})
