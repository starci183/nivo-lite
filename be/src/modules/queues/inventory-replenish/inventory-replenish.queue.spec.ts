import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { INVENTORY_REPLENISH_QUEUE, InventoryReplenishQueue, isReplenishPayload } from "./inventory-replenish.queue"

const payload = { workspaceId: "ws-1", itemIds: ["item-1"] }

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [InventoryReplenishQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(InventoryReplenishQueue), outbox }
}

describe("InventoryReplenishQueue", () => {
    it("writes the low-stock check in the caller's transaction", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueReplenish(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, INVENTORY_REPLENISH_QUEUE, payload)
    })
})

describe("isReplenishPayload", () => {
    it("accepts a list of item ids and refuses a mixed list", () => {
        expect(isReplenishPayload(payload)).toBe(true)
        expect(isReplenishPayload({ workspaceId: "ws-1", itemIds: [] })).toBe(true)
        expect(isReplenishPayload(null)).toBe(false)
        expect(isReplenishPayload({ itemIds: ["item-1"] })).toBe(false)
        expect(isReplenishPayload({ workspaceId: 1, itemIds: ["item-1"] })).toBe(false)
        expect(isReplenishPayload({ workspaceId: "ws-1" })).toBe(false)
        expect(isReplenishPayload({ workspaceId: "ws-1", itemIds: "item-1" })).toBe(false)
        expect(isReplenishPayload({ workspaceId: "ws-1", itemIds: ["item-1", 2] })).toBe(false)
    })
})
