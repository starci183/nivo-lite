import assert from "node:assert/strict"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    SEPAY_DELIVERY_QUEUE as DOMAIN_QUEUE,
    SEPAY_DELIVERY_QUEUE,
    isSepayDeliveryRecorded,
} from "@modules/queues/sepay-delivery"
import { SepayDeliveryQueueModule } from "@features/jobs/sepay-delivery"
import { deliveryIntakeFixture, persistDeliveryWorkspace } from "../../world/delivery-jobs-proof.service"
import { deliveryCapabilities } from "../../world/delivery-capabilities.options"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"
import type { LiteWorld } from "../../world/lite-world.service"

const registerParsing = (): void => {
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
        expect(isSepayDeliveryRecorded(value)).toBe(false)
    })

    it("accepts a durable receipt identity and agrees with the intake queue", () => {
        expect(isSepayDeliveryRecorded({ deliveryId: "delivery-1" })).toBe(true)
        expect(SEPAY_DELIVERY_QUEUE).toBe(DOMAIN_QUEUE)
    })
}

const registerPublication = (world: LiteWorld, workspaceId: string): void => {
    it("publishes in the caller transaction with the intake dedupe key", async () => {
        const fixture = await deliveryIntakeFixture(world, "sepay", workspaceId)
        const outbox = world.resolve<QueueOutbox>(QUEUE_OUTBOX)
        const publish = outbox.write.bind(outbox)
        const write = jest.spyOn(outbox, "write").mockImplementation(async (manager, queue, message, options) => {
            expect(manager.queryRunner?.isTransactionActive).toBe(true)
            await publish(manager, queue, message, options)
            expect(await fixture.state()).toEqual({ receipts: [], jobs: [], messages: [] })
        })
        await fixture.accept()
        const manager = write.mock.calls[0]?.[0]
        assert(manager !== undefined)
        expect(write).toHaveBeenCalledWith(manager, SEPAY_DELIVERY_QUEUE, fixture.message, {
            dedupeKey: `sepay-delivery:${fixture.message.deliveryId}`,
        })
        const state = await fixture.state()
        expect(state.receipts).toHaveLength(1)
        expect(state.receipts[0]?.processed_at).toBeNull()
        expect(state.jobs).toHaveLength(1)
        expect(state.jobs[0]).toMatchObject({
            payload: fixture.message,
            dedupe_key: `sepay-delivery:${fixture.message.deliveryId}`,
        })
        expect(state.messages).toEqual([
            { message: expect.objectContaining({ payload: fixture.message, outbox_id: state.jobs[0]?.id }) },
        ])
    })

    it("propagates publication failure so the caller can roll back", async () => {
        const fixture = await deliveryIntakeFixture(world, "sepay", workspaceId)
        const outbox = world.resolve<QueueOutbox>(QUEUE_OUTBOX)
        const publish = outbox.write.bind(outbox)
        const failure = new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
        jest.spyOn(outbox, "write").mockImplementationOnce(async (...args) => {
            await publish(...args)
            throw failure
        })
        await expect(fixture.accept()).rejects.toBe(failure)
        expect(await fixture.state()).toEqual({ receipts: [], jobs: [], messages: [] })
        await fixture.accept()
        expect((await fixture.state()).receipts).toHaveLength(1)
        expect((await fixture.state()).jobs).toHaveLength(1)
    })
}

describe("SepayDeliveryQueue (domain intake integration)", () => {
    const capability = deliveryCapabilities()
    const world = useTestWorld({ modules: [...capability.modules, SepayDeliveryQueueModule.register({})] })
    beforeAll(() => persistDeliveryWorkspace(world, capability.workspaceId))
    beforeEach(() => jest.restoreAllMocks())
    afterEach(() => jest.restoreAllMocks())
    registerParsing()
    registerPublication(world, capability.workspaceId)
})
