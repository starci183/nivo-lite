import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { HoldForOwnerCheckStep } from "../../steps/hold-for-owner-check.step"
import { ReconcileBankCreditProcessor } from "./reconcile-bank-credit.processor"

const jobOf = builder<ClaimedJob>({
    jobId: "bank-credit-job-1",
    kind: "bank_credit_received",
    fencingToken: 7,
    currentStep: "hold",
    payload: { workspaceId: "workspace-1", inboundEventId: "event-1", amountVnd: 250000 },
})

const build = async () => {
    const holdForOwnerCheck = mock<HoldForOwnerCheckStep>()
    holdForOwnerCheck.run.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [ReconcileBankCreditProcessor, { provide: HoldForOwnerCheckStep, useValue: holdForOwnerCheck }],
    }).compile()
    return { processor: moduleRef.get(ReconcileBankCreditProcessor), holdForOwnerCheck }
}

describe("ReconcileBankCreditProcessor", () => {
    it("consumes the bank credit queue with the default job and concurrency", async () => {
        const { processor } = await build()

        expect([processor.queue, processor.job, processor.concurrency]).toEqual([
            "bank_credit_received",
            undefined,
            undefined,
        ])
    })

    it("passes the complete fenced claim to the step and awaits its completion", async () => {
        const { processor, holdForOwnerCheck } = await build()
        const job = jobOf()
        let release: () => void = () => undefined
        const pending = new Promise<void>((resolve) => {
            release = resolve
        })
        holdForOwnerCheck.run.mockReturnValue(pending)
        let finished = false

        const processing = processor.process(job).then(() => {
            finished = true
        })
        await Promise.resolve()

        expect(holdForOwnerCheck.run.mock.calls).toEqual([[job]])
        expect(holdForOwnerCheck.run.mock.calls[0]?.[0]).toBe(job)
        expect(finished).toBe(false)
        release()
        await expect(processing).resolves.toBeUndefined()
        expect(finished).toBe(true)
        expect(holdForOwnerCheck.run.mock.calls).toEqual([[job]])
    })

    it("propagates the stale-token refusal from the step unchanged", async () => {
        const { processor, holdForOwnerCheck } = await build()
        const job = jobOf()
        const refusal = new Error("JOBS_FENCED_OUT")
        holdForOwnerCheck.run.mockRejectedValue(refusal)

        await expect(processor.process(job)).rejects.toBe(refusal)

        expect(holdForOwnerCheck.run.mock.calls).toEqual([[job]])
    })

    it("propagates a feed failure so the queue can retry the delivery", async () => {
        const { processor, holdForOwnerCheck } = await build()
        const job = jobOf()
        const failure = new Error("bank feed unavailable")
        holdForOwnerCheck.run.mockRejectedValue(failure)

        await expect(processor.process(job)).rejects.toBe(failure)

        expect(holdForOwnerCheck.run.mock.calls).toEqual([[job]])
    })
})
