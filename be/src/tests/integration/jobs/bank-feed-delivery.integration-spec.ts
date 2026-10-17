import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"
import { bankFeedDeliveryBuilder as build } from "../../world/bank-feed-delivery-proof.service"
import { useTestWorld } from "../../world/use-test-world"
import { JOBS_MODULES } from "../../world/test-capabilities.options"
import { cleanupJobs, jobSnapshot } from "../../world/proof-database.service"

describe("BankFeedDeliveryProcessor (persisted integration)", () => {
    const world = useTestWorld({ modules: [...JOBS_MODULES] })
    beforeAll(() => world.cleanup(() => cleanupJobs(world.db.primary, world.prefix)))
    it("advances the live claim before consuming its committed receipt", async () => {
        const { processor, inbox, claims, job, advance } = await build(world)
        claims.advance.mockImplementation(() => {
            expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
            return advance({ jobId: job.jobId, expectedFencingToken: job.fencingToken, step: "bank-feed-delivery" })
        })

        await processor.process(job)

        expect(processor.queue).toBe(BANK_FEED_DELIVERY_QUEUE)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: job.jobId,
            expectedFencingToken: 3,
            step: "bank-feed-delivery",
        })
        expect(inbox.processRecordedFeedDelivery).toHaveBeenCalledWith(job.payload)
    })

    it.each([
        {},
        { deliveryId: "" },
        { deliveryId: "   " },
        { deliveryId: 1 },
        { deliveryId: "delivery-1" },
        { deliveryId: "delivery-1", provider: "unknown" },
        { deliveryId: "delivery-1", provider: null },
    ])("discards invalid references before any claim or effect: %p", async (payload) => {
        const { processor, inbox, claims, job } = await build(world)
        await processor.process({ ...job, payload })
        expect(claims.advance).not.toHaveBeenCalled()
        expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
    })

    it("stops a stale claim before the domain effect", async () => {
        const { processor, inbox, claims, job } = await build(world)
        const failure = new Error("stale fence")
        claims.advance.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
        expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
    })

    it("propagates consumer failure for a retry of the pending receipt", async () => {
        const { processor, inbox, job } = await build(world)
        const failure = new Error("receipt processing failed")
        inbox.processRecordedFeedDelivery.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
    })

    it("registers its processor with the composed job runner", async () => {
        const { registry, processor, runner, delivery, clock, inbox } = await build(world)
        expect(registry.add).toHaveBeenCalledWith(processor)
        clock.advance(101)
        await runner.run(processor, delivery)
        expect(await jobSnapshot(world.db.primary, delivery.id)).toMatchObject({
            status: "done",
            current_step: "bank-feed-delivery",
            fencing_token: "4",
        })
        expect(inbox.processRecordedFeedDelivery).toHaveBeenCalledWith(delivery.payload)
    })
})
