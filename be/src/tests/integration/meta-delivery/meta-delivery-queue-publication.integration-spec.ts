import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"
import { META_DELIVERY_QUEUE as DOMAIN_QUEUE } from "@modules/queues/meta-delivery"
import { META_DELIVERY_QUEUE, isMetaDeliveryRecorded } from "@modules/queues/meta-delivery"
import type { MetaDeliveryRecorded } from "@modules/queues/meta-delivery"
import { buildMetaDelivery } from "@tests/fixtures/builders/meta-delivery.builder"
import { useTestWorld } from "../../world/use-test-world"
import { QUEUE_MODULES, queueOptions } from "../../world/test-capabilities.options"

const message: MetaDeliveryRecorded = { deliveryId: "delivery-1" }

describe("MetaDeliveryQueue", () => {
    const world = useTestWorld({ modules: [...QUEUE_MODULES] })
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
        expect(isMetaDeliveryRecorded(value)).toBe(false)
    })

    it("accepts a durable receipt identity and agrees with the intake queue", () => {
        expect(isMetaDeliveryRecorded(message)).toBe(true)
        expect(META_DELIVERY_QUEUE).toBe(DOMAIN_QUEUE)
    })

    it("publishes in the caller transaction with the intake dedupe key", async () => {
        const { queue, outbox } = buildMetaDelivery(world.db.primary, queueOptions)
        const write = jest.spyOn(outbox, "write")
        const rollback = new TestWorldError({ code: TestWorldErrorCode.TransactionRefused })
        await expect(
            world.db.primary.transaction(async (manager) => {
                await queue.enqueueDeliveryRecorded(message, manager)
                expect(write).toHaveBeenCalledWith(manager, META_DELIVERY_QUEUE, message, {
                    dedupeKey: "meta-delivery:delivery-1",
                })
                throw rollback
            }),
        ).rejects.toBe(rollback)
    })

    it("propagates publication failure so the caller can roll back", async () => {
        const { queue, outbox } = buildMetaDelivery(world.db.primary, queueOptions)
        const write = jest.spyOn(outbox, "write")
        const failure = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        write.mockRejectedValueOnce(failure)
        await expect(
            world.db.primary.transaction((manager) => queue.enqueueDeliveryRecorded(message, manager)),
        ).rejects.toBe(failure)
    })
})
