import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { PaymentOrderRequestsService } from "@modules/domain/payment-order-requests/payment-order-requests.service"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { JobsError, JobsErrorCode } from "@modules/platform/jobs/errors/jobs.error"
import { JOB_CLAIMS } from "@modules/platform/jobs/jobs.decorators"
import { PlaceOrderStep } from "./place-order.step"

const JOB: ClaimedJob = {
    jobId: "job-1",
    kind: "payment_order_requested",
    fencingToken: 3,
    currentStep: null,
    payload: { workspaceId: "ws-1", requestId: "request-1" },
}

const build = async () => {
    const requests = mock<PaymentOrderRequestsService>()
    const claims = mock<JobClaims>()
    claims.advance.mockResolvedValue(undefined)
    requests.answer.mockResolvedValue("ordered")
    const moduleRef = await Test.createTestingModule({
        providers: [
            PlaceOrderStep,
            { provide: PaymentOrderRequestsService, useValue: requests },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(PlaceOrderStep), requests, claims }
}

describe("PlaceOrderStep", () => {
    it("waits for the guarded step write before answering the payment order request", async () => {
        const { step, requests, claims } = await build()
        let finishAdvance!: () => void
        claims.advance.mockImplementationOnce(
            () =>
                new Promise<void>((resolve) => {
                    finishAdvance = resolve
                }),
        )

        const pending = step.run(JOB)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "place" })
        expect(requests.answer).not.toHaveBeenCalled()
        finishAdvance()
        await expect(pending).resolves.toBeUndefined()
        expect(requests.answer).toHaveBeenCalledTimes(1)
        expect(requests.answer).toHaveBeenCalledWith({ workspaceId: "ws-1", requestId: "request-1" })
    })

    it("throws a stale-token refusal before answering the request", async () => {
        const { step, requests, claims } = await build()
        const refusal = new JobsError({
            code: JobsErrorCode.FencedOut,
            params: { jobId: "job-1", token: 3 },
        })
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(JOB)).rejects.toBe(refusal)

        expect(requests.answer).not.toHaveBeenCalled()
        expect(claims.complete).not.toHaveBeenCalled()
        expect(claims.fail).not.toHaveBeenCalled()
    })

    it("throws an answering failure so the runner can retry the job", async () => {
        const { step, requests, claims } = await build()
        const failure = new Error("database unavailable")
        requests.answer.mockRejectedValue(failure)

        await expect(step.run(JOB)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "place" })
        expect(requests.answer).toHaveBeenCalledWith({ workspaceId: "ws-1", requestId: "request-1" })
        expect(claims.complete).not.toHaveBeenCalled()
        expect(claims.fail).not.toHaveBeenCalled()
    })

    it.each(["failed", "ignored"] as const)("completes the step when the request outcome is %s", async (outcome) => {
        const { step, requests } = await build()
        requests.answer.mockResolvedValue(outcome)

        await expect(step.run(JOB)).resolves.toBeUndefined()

        expect(requests.answer).toHaveBeenCalledTimes(1)
        expect(requests.answer).toHaveBeenCalledWith({ workspaceId: "ws-1", requestId: "request-1" })
    })
})
