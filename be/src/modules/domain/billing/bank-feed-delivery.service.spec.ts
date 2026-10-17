import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BankFeedService } from "./bank-feed.service"
import { BankFeedDeliveryService } from "./bank-feed-delivery.service"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { BANK_FEED_DELIVERY_QUEUE } from "@modules/queues/bank-feed-delivery"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: BANK_FEED_DELIVERY_QUEUE,
    fencingToken: 3,
    currentStep: null,
    payload: { provider: "casso", deliveryId: "connection:delivery-1" },
}

const build = async () => {
    const inbox = mock<BankFeedService>()
    inbox.processRecordedFeedDelivery.mockResolvedValue(undefined)
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            BankFeedDeliveryService,
            { provide: BankFeedService, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { processor: moduleRef.get(BankFeedDeliveryService), inbox, claims }
}

describe("BankFeedDeliveryService", () => {
    it("advances the live claim before consuming its committed receipt", async () => {
        const { processor, inbox, claims } = await build()
        claims.advance.mockImplementation(() => {
            expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
            return Promise.resolve()
        })

        await processor.process(job)

        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-1",
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
        const { processor, inbox, claims } = await build()
        await processor.process({ ...job, payload })
        expect(claims.advance).not.toHaveBeenCalled()
        expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
    })

    it("stops a stale claim before the domain effect", async () => {
        const { processor, inbox, claims } = await build()
        const failure = new Error("stale fence")
        claims.advance.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
        expect(inbox.processRecordedFeedDelivery).not.toHaveBeenCalled()
    })

    it("propagates consumer failure for a retry of the pending receipt", async () => {
        const { processor, inbox } = await build()
        const failure = new Error("receipt processing failed")
        inbox.processRecordedFeedDelivery.mockRejectedValue(failure)
        await expect(processor.process(job)).rejects.toBe(failure)
    })
})
