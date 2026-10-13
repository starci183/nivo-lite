import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { JobsError, JobsErrorCode } from "@modules/platform/jobs/errors/jobs.error"
import { PlaceOrderStep } from "../../steps/place-order.step"
import { CreatePaymentOrderProcessor } from "./create-payment-order.processor"

const JOB: ClaimedJob = {
    jobId: "job-1",
    kind: "payment_order_requested",
    fencingToken: 3,
    currentStep: "place",
    payload: { workspaceId: "ws-1", requestId: "request-1" },
}

const build = async () => {
    const placeOrder = mock<PlaceOrderStep>()
    placeOrder.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [CreatePaymentOrderProcessor, { provide: PlaceOrderStep, useValue: placeOrder }],
    }).compile()
    return { processor: moduleRef.get(CreatePaymentOrderProcessor), placeOrder }
}

describe("CreatePaymentOrderProcessor", () => {
    it("consumes every payment order request with the runner's default concurrency", async () => {
        const { processor } = await build()

        expect(processor.queue).toBe("payment_order_requested")
        expect(processor.job).toBeUndefined()
        expect(processor.concurrency).toBeUndefined()
    })

    it("delegates the fenced claim to the order step and waits for it to finish", async () => {
        const { processor, placeOrder } = await build()
        let finishStep!: () => void
        placeOrder.run.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishStep = resolve
                }),
        )
        const completed = jest.fn()

        const pending = processor.process(JOB).then(completed)
        await Promise.resolve()

        expect(placeOrder.run).toHaveBeenCalledTimes(1)
        expect(placeOrder.run).toHaveBeenCalledWith({
            jobId: "job-1",
            kind: "payment_order_requested",
            fencingToken: 3,
            currentStep: "place",
            payload: { workspaceId: "ws-1", requestId: "request-1" },
        })
        expect(completed).not.toHaveBeenCalled()
        finishStep()
        await pending
        expect(completed).toHaveBeenCalledTimes(1)
        expect(completed).toHaveBeenCalledWith(undefined)
    })

    it("throws the stale-token refusal from the order step to the runner", async () => {
        const { processor, placeOrder } = await build()
        const refusal = new JobsError({
            code: JobsErrorCode.FencedOut,
            params: { jobId: "job-1", token: 3 },
        })
        placeOrder.run.mockRejectedValue(refusal)

        await expect(processor.process(JOB)).rejects.toBe(refusal)

        expect(placeOrder.run).toHaveBeenCalledTimes(1)
        expect(placeOrder.run).toHaveBeenCalledWith(JOB)
    })

    it("throws an order-step failure so the queue can retry it", async () => {
        const { processor, placeOrder } = await build()
        const failure = new Error("database unavailable")
        placeOrder.run.mockRejectedValue(failure)

        await expect(processor.process(JOB)).rejects.toBe(failure)

        expect(placeOrder.run).toHaveBeenCalledTimes(1)
        expect(placeOrder.run).toHaveBeenCalledWith(JOB)
    })
})
