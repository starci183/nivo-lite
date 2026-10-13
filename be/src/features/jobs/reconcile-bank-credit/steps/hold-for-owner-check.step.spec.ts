import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { BankFeedService } from "@modules/domain/billing"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { HoldForOwnerCheckStep } from "./hold-for-owner-check.step"

const jobOf = builder<ClaimedJob>({
    jobId: "bank-credit-job-1",
    kind: "bank_credit_received",
    fencingToken: 7,
    currentStep: null,
    payload: { workspaceId: "workspace-1", inboundEventId: "event-1", amountVnd: 250000 },
})

const build = async () => {
    const feed = mock<BankFeedService>()
    const claims = mock<JobClaims>()
    feed.holdForOwnerCheck.mockResolvedValue(undefined)
    claims.advance.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            HoldForOwnerCheckStep,
            { provide: BankFeedService, useValue: feed },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { step: moduleRef.get(HoldForOwnerCheckStep), feed, claims }
}

describe("HoldForOwnerCheckStep", () => {
    it("waits for the fenced hold write before holding the credit for the owner", async () => {
        const { step, feed, claims } = await build()
        const job = jobOf()
        let release: () => void = () => undefined
        const advanced = new Promise<void>((resolve) => {
            release = resolve
        })
        claims.advance.mockReturnValue(advanced)

        const running = step.run(job)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "bank-credit-job-1", expectedFencingToken: 7, step: "hold" }],
        ])
        expect(feed.holdForOwnerCheck.mock.calls).toEqual([])
        release()
        await expect(running).resolves.toBeUndefined()
        expect(feed.holdForOwnerCheck.mock.calls).toEqual([[job.payload]])
        expect(feed.holdForOwnerCheck.mock.calls[0]?.[0]).toBe(job.payload)
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it.each([{}, { inboundEventId: 42 }])("passes an invalid payload to the feed unchanged: %j", async (payload) => {
        const { step, feed, claims } = await build()

        await expect(step.run(jobOf({ payload }))).resolves.toBeUndefined()

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "bank-credit-job-1", expectedFencingToken: 7, step: "hold" }],
        ])
        expect(feed.holdForOwnerCheck.mock.calls).toEqual([[payload]])
        expect(feed.holdForOwnerCheck.mock.calls[0]?.[0]).toBe(payload)
    })

    it("propagates a stale-token refusal before holding the credit", async () => {
        const { step, feed, claims } = await build()
        const refusal = new Error("JOBS_FENCED_OUT")
        claims.advance.mockRejectedValue(refusal)

        await expect(step.run(jobOf())).rejects.toBe(refusal)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "bank-credit-job-1", expectedFencingToken: 7, step: "hold" }],
        ])
        expect(feed.holdForOwnerCheck.mock.calls).toEqual([])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })

    it("propagates the feed failure after recording the fenced step", async () => {
        const { step, feed, claims } = await build()
        const job = jobOf()
        const failure = new Error("bank feed unavailable")
        feed.holdForOwnerCheck.mockRejectedValue(failure)

        await expect(step.run(job)).rejects.toBe(failure)

        expect(claims.advance.mock.calls).toEqual([
            [{ jobId: "bank-credit-job-1", expectedFencingToken: 7, step: "hold" }],
        ])
        expect(feed.holdForOwnerCheck.mock.calls).toEqual([[job.payload]])
        expect(claims.complete.mock.calls).toEqual([])
        expect(claims.fail.mock.calls).toEqual([])
    })
})
