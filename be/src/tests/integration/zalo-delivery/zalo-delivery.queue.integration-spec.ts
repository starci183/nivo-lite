import { ZALO_DELIVERY_QUEUE as PUBLIC_QUEUE } from "@modules/queues/zalo-delivery"
import type { ZaloDeliveryRecorded } from "@modules/queues/zalo-delivery"
import { ZALO_DELIVERY_QUEUE, isZaloDeliveryRecorded } from "../../../modules/queues/zalo-delivery/zalo-delivery.queue"
import { useTestWorld } from "../../world/use-test-world"
import {
    RECEIPT_DELIVERY_MODULES,
    zaloPublicationBuilder as build,
    zaloDeliveryState,
} from "../../world/zalo-delivery-proof.service"

const message: ZaloDeliveryRecorded = { deliveryId: "delivery-1" }

describe("ZaloDeliveryQueue", () => {
    const world = useTestWorld({ modules: [...RECEIPT_DELIVERY_MODULES] })
    afterEach(() => jest.restoreAllMocks())
    it.each([
        undefined,
        null,
        1,
        "delivery-1",
        {},
        { deliveryId: null },
        { deliveryId: 42 },
        { deliveryId: "" },
        { deliveryId: "   " },
    ])("refuses malformed receipt references: %p", (value) => {
        expect(isZaloDeliveryRecorded(value)).toBe(false)
    })

    it("accepts a durable receipt identity and agrees with the public intake contract", () => {
        expect(isZaloDeliveryRecorded(message)).toBe(true)
        expect(ZALO_DELIVERY_QUEUE).toBe(PUBLIC_QUEUE)
        expect(ZALO_DELIVERY_QUEUE).toBe("zalo-delivery")
    })

    it("publishes in the caller transaction with the intake dedupe key", async () => {
        const { queue, outbox, message } = build(world)
        await world.db.primary.transaction(async (manager) => {
            await queue.enqueueDeliveryRecorded(message, manager)
            expect(outbox.write).toHaveBeenCalledWith(manager, ZALO_DELIVERY_QUEUE, message, {
                dedupeKey: `zalo-delivery:${message.deliveryId}`,
            })
            expect(await zaloDeliveryState(world, message.deliveryId)).toEqual({ receipts: [], jobs: [], messages: [] })
        })
        const state = await zaloDeliveryState(world, message.deliveryId)
        expect(state.jobs).toHaveLength(1)
        expect(state.jobs[0]).toMatchObject({ payload: message, dedupe_key: `zalo-delivery:${message.deliveryId}` })
        expect(state.messages).toHaveLength(1)
    })

    it("propagates publication failure so the caller can roll back", async () => {
        const { queue, outbox, message } = build(world)
        const failure = new Error("publication failed")
        outbox.write.mockRejectedValue(failure)
        await expect(
            world.db.primary.transaction((manager) => queue.enqueueDeliveryRecorded(message, manager)),
        ).rejects.toBe(failure)
        expect(await zaloDeliveryState(world, message.deliveryId)).toEqual({ receipts: [], jobs: [], messages: [] })
    })
})
