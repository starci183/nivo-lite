import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { TelegramDeliveryService } from "./telegram-delivery.service"
import { TELEGRAM_RECEIPT_PROCESSOR } from "./telegram-inbox.decorators"
import type { TelegramReceiptProcessor } from "./telegram-inbox.port"

const jobOf = builder<ClaimedJob>({
    jobId: "job-1",
    kind: "telegram-delivery",
    fencingToken: 3,
    currentStep: null,
    payload: { deliveryId: "delivery-1" },
})

const build = async () => {
    const inbox = mock<TelegramReceiptProcessor>()
    inbox.processRecordedDelivery.mockResolvedValue(undefined)
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            TelegramDeliveryService,
            { provide: TELEGRAM_RECEIPT_PROCESSOR, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { service: moduleRef.get(TelegramDeliveryService), inbox, claims }
}

describe("TelegramDeliveryService", () => {
    it.each([{}, { deliveryId: null }, { deliveryId: 42 }, { deliveryId: "" }, { deliveryId: "   " }])(
        "leaves malformed jobs untouched: %p",
        async (payload) => {
            const { service, inbox, claims } = await build()
            await service.process(jobOf({ payload }))
            expect(claims.advance).not.toHaveBeenCalled()
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
        },
    )

    it.each([null, undefined, 1, "delivery-1"])("rejects malformed runtime payloads: %p", async (payload) => {
        const { service, inbox, claims } = await build()
        const job = jobOf()
        Object.defineProperty(job, "payload", { value: payload })
        await service.process(job)
        expect(claims.advance).not.toHaveBeenCalled()
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("awaits the live fence before resolving the receipt without changing its identity", async () => {
        const { service, inbox, claims } = await build()
        const job = jobOf()
        claims.advance.mockImplementation(() => {
            expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
            return Promise.resolve()
        })
        await service.process(job)
        expect(claims.advance).toHaveBeenCalledWith({
            jobId: "job-1",
            expectedFencingToken: 3,
            step: "telegram-delivery",
        })
        expect(inbox.processRecordedDelivery).toHaveBeenCalledWith(job.payload)
    })

    it("stops a stale fence before the receipt effect", async () => {
        const { service, inbox, claims } = await build()
        const failure = new Error("stale fence")
        claims.advance.mockRejectedValue(failure)
        await expect(service.process(jobOf())).rejects.toBe(failure)
        expect(inbox.processRecordedDelivery).not.toHaveBeenCalled()
    })

    it("propagates receipt failures for retry", async () => {
        const { service, inbox } = await build()
        const failure = new Error("receipt failure")
        inbox.processRecordedDelivery.mockRejectedValue(failure)
        await expect(service.process(jobOf())).rejects.toBe(failure)
    })
})
