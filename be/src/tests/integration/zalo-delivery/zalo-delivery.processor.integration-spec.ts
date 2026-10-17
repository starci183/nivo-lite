import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"
import { ZaloDeliveryQueueModule } from "../../../features/jobs/zalo-delivery/transport/queue/zalo-delivery-queue.module"
import { useTestWorld } from "../../world/use-test-world"
import {
    RECEIPT_DELIVERY_MODULES,
    zaloDeliveryBuilder as build,
    zaloDeliveryState,
    registerZaloDelivery,
} from "../../world/zalo-delivery-proof.service"
import { cleanupJobs, jobSnapshot } from "../../world/proof-database.service"

describe("ZaloDeliveryProcessor", () => {
    const world = useTestWorld({ modules: [...RECEIPT_DELIVERY_MODULES, ZaloDeliveryQueueModule.register({})] })
    beforeAll(() => world.cleanup(() => cleanupJobs(world.db.primary, world.prefix)))
    afterEach(() => jest.restoreAllMocks())
    it("advances the live claim before consuming its committed receipt", async () => {
        const { processor, inbox, claims, job, jobKey, message, advance } = await build(world)
        claims.advance.mockImplementation(() => {
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
            return advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "zalo-delivery" })
        })

        await processor.process(job)

        expect(processor.queue).toBe(ZALO_DELIVERY_QUEUE)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: job.jobId,
            expectedFencingToken: 3,
            step: "zalo-delivery",
        })
        expect(inbox.processRecordedDelivery).toHaveBeenCalledWith(job.payload)
        expect((await zaloDeliveryState(world, message.deliveryId)).receipts[0]?.processed_at).toEqual(expect.any(Date))
        expect(await jobSnapshot(world.db.primary, jobKey)).toMatchObject({
            current_step: "zalo-delivery",
            fencing_token: "3",
        })
    })

    it.each([{}, { deliveryId: "" }, { deliveryId: "   " }, { deliveryId: 1 }])(
        "discards invalid references before any claim or effect: %p",
        async (payload) => {
            const { processor, inbox, claims, job } = await build(world)
            await processor.process({ ...job, payload })
            expect(claims.advance).not.toHaveBeenCalled()
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
        },
    )

    it("stops a stale claim before the domain effect", async () => {
        const { processor, inbox, claims, job } = await build(world)
        const failure = new Error("stale fence")
        claims.advance.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("propagates consumer failure for a retry of the pending receipt", async () => {
        const { processor, inbox, job, message } = await build(world)
        const failure = new Error("receipt processing failed")
        inbox.processRecordedDelivery.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
        const state = await zaloDeliveryState(world, message.deliveryId)
        expect(state.receipts[0]?.processed_at).toBeNull()
    })
})

describe("ZaloDeliveryQueueModule", () => {
    const world = useTestWorld({ modules: [...RECEIPT_DELIVERY_MODULES, ZaloDeliveryQueueModule.register({})] })
    afterEach(() => jest.restoreAllMocks())
    it("registers its processor with the composed job runner", () => {
        const { registry, processor } = registerZaloDelivery(world)
        expect(registry.add).toHaveBeenCalledWith(processor)
    })
})
