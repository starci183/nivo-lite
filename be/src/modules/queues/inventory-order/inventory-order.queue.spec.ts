import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { INVENTORY_ORDER_QUEUE, InventoryOrderQueue, isDeductOrderPayload } from "./inventory-order.queue"

const payload = { workspaceId: "ws-1", orderId: "order-1", orderNo: "DH-1", items: "2 cafe" }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [InventoryOrderQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(InventoryOrderQueue), outbox }
}

describe("InventoryOrderQueue", () => {
    it("writes the deduction in the caller's transaction", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueDeductOrder(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, INVENTORY_ORDER_QUEUE, payload)
    })
})

describe("isDeductOrderPayload", () => {
    it("accepts the order fields and refuses a malformed one", () => {
        expect(isDeductOrderPayload(payload)).toBe(true)
        expect(isDeductOrderPayload(null)).toBe(false)
        expect(isDeductOrderPayload({ ...payload, workspaceId: 1 })).toBe(false)
        expect(isDeductOrderPayload({ ...payload, orderId: 1 })).toBe(false)
        expect(isDeductOrderPayload({ ...payload, orderNo: 1 })).toBe(false)
        expect(isDeductOrderPayload({ ...payload, items: 1 })).toBe(false)
        expect(isDeductOrderPayload({ workspaceId: "ws-1", orderId: "order-1", orderNo: "DH-1" })).toBe(false)
    })
})
