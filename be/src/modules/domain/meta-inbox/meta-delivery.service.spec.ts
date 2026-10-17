import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { MetaDeliveryService } from "./meta-delivery.service"
import { META_RECEIPT_PROCESSOR } from "./meta-inbox.decorators"
import type { MetaReceiptProcessor } from "./meta-inbox.port"
import { MetaInboxError, MetaInboxErrorCode } from "./errors/meta-inbox.error"

const jobOf = (payload: object): ClaimedJob => ({
    jobId: "job-1",
    kind: "meta-delivery",
    fencingToken: 7,
    currentStep: null,
    payload,
})

const build = async () => {
    const inbox = mock<MetaReceiptProcessor>()
    const claims = mock<JobClaims>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaDeliveryService,
            { provide: META_RECEIPT_PROCESSOR, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { service: moduleRef.get(MetaDeliveryService), inbox, claims }
}

describe("MetaDeliveryService", () => {
    it.each([{}, { deliveryId: 7 }, { deliveryId: " " }])("ignores an invalid receipt %j", async (payload) => {
        const { service, inbox, claims } = await build()
        await service.process(jobOf(payload))
        expect(claims.advance).not.toHaveBeenCalled()
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("records the fence before processing the unchanged receipt", async () => {
        const { service, inbox, claims } = await build()
        const payload = { deliveryId: "receipt-1" }
        claims.advance.mockImplementation(async () => {
            await Promise.resolve()
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
        })
        await service.process(jobOf(payload))
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-1",
            expectedFencingToken: 7,
            step: "meta-delivery",
        })
        expect(inbox.processRecordedDelivery).toHaveBeenCalledWith(payload)
        expect(claims.advance.mock.invocationCallOrder[0]).toBeLessThan(
            inbox.processRecordedDelivery.mock.invocationCallOrder[0] ?? 0,
        )
    })

    it("does no receipt work when the fence is refused", async () => {
        const { service, inbox, claims } = await build()
        const refusal = new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        claims.advance.mockRejectedValue(refusal)
        await expect(service.process(jobOf({ deliveryId: "receipt-1" }))).rejects.toBe(refusal)
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("propagates processing failures after advancing", async () => {
        const { service, inbox, claims } = await build()
        const refusal = new MetaInboxError({ code: MetaInboxErrorCode.SignatureInvalid })
        inbox.processRecordedDelivery.mockRejectedValue(refusal)
        await expect(service.process(jobOf({ deliveryId: "receipt-1" }))).rejects.toBe(refusal)
        expect(claims.advance).toHaveBeenCalledTimes(1)
    })
})
