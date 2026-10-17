import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ZaloDeliveryConsumer } from "./zalo-delivery.port"
import { ZaloDeliveryPolicy } from "./zalo-delivery.policy"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { ZALO_DELIVERY_QUEUE } from "@modules/queues/zalo-delivery"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: ZALO_DELIVERY_QUEUE,
    fencingToken: 3,
    currentStep: null,
    payload: { deliveryId: "delivery-1" },
}

const build = async () => {
    const inbox = mock<ZaloDeliveryConsumer>()
    inbox.processRecordedDelivery.mockResolvedValue(undefined)
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloDeliveryPolicy],
    }).compile()
    return { processor: moduleRef.get(ZaloDeliveryPolicy), inbox, claims }
}

describe("ZaloDeliveryPolicy", () => {
    it("advances the live claim before consuming its committed receipt", async () => {
        const { processor, inbox, claims } = await build()
        claims.advance.mockImplementation(() => {
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
            return Promise.resolve()
        })

        await processor.run(job, claims, inbox)

        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-1",
            expectedFencingToken: 3,
            step: "zalo-delivery",
        })
        expect(inbox.processRecordedDelivery).toHaveBeenCalledWith(job.payload)
    })

    it.each([{}, { deliveryId: "" }, { deliveryId: "   " }, { deliveryId: 1 }])(
        "discards invalid references before any claim or effect: %p",
        async (payload) => {
            const { processor, inbox, claims } = await build()
            await processor.run({ ...job, payload }, claims, inbox)
            expect(claims.advance).not.toHaveBeenCalled()
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
        },
    )

    it("stops a stale claim before the domain effect", async () => {
        const { processor, inbox, claims } = await build()
        const failure = new Error("stale fence")
        claims.advance.mockRejectedValue(failure)
        await expect(processor.run(job, claims, inbox)).rejects.toBe(failure)
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("propagates consumer failure for a retry of the pending receipt", async () => {
        const { processor, inbox, claims } = await build()
        const failure = new Error("receipt processing failed")
        inbox.processRecordedDelivery.mockRejectedValue(failure)
        await expect(processor.run(job, claims, inbox)).rejects.toBe(failure)
    })
})
