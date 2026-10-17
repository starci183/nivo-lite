import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AdvancingJobStepPolicy } from "./advancing.policy"
import { JobsError, JobsErrorCode } from "./errors/jobs.error"
import type { ClaimedJob, JobEffect } from "./jobs.contracts"
import type { JobClaims } from "./jobs.port"

const job: ClaimedJob = {
    jobId: "job-1",
    kind: "mail",
    fencingToken: 3,
    currentStep: null,
    payload: { messageId: "message-1" },
}

class DeliveryStep extends AdvancingJobStepPolicy {
    constructor(
        claims: JobClaims,
        private readonly delivery: JobEffect<unknown>,
    ) {
        super(claims, "deliver")
    }

    protected perform(payload: object): Promise<unknown> {
        expect(payload).toBe(job.payload)
        return this.delivery()
    }
}

const build = async (claims: JobClaims, delivery: JobEffect<unknown>) => {
    const claimWriter = mock<JobClaims>({ advance: claims.advance })
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: AdvancingJobStepPolicy, useFactory: () => new DeliveryStep(claimWriter, delivery) }],
    }).compile()
    return moduleRef.get(AdvancingJobStepPolicy)
}

describe("AdvancingJobStepPolicy", () => {
    it("waits for the fenced advance before starting its domain effect and discards the effect's result", async () => {
        const claims = mock<JobClaims>()
        let releaseAdvance: () => void = () => undefined
        claims.advance.mockReturnValue(
            new Promise<void>((resolve) => {
                releaseAdvance = resolve
            }),
        )
        const delivery = jest.fn().mockResolvedValue({ sent: true })

        const run = (await build(claims, delivery)).run(job)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "deliver" })
        expect(delivery).not.toHaveBeenCalled()
        releaseAdvance()
        await expect(run).resolves.toBeUndefined()
        expect(delivery).toHaveBeenCalledTimes(1)
    })

    it("propagates a stale-token rejection without starting the domain effect", async () => {
        const claims = mock<JobClaims>()
        const failure = new JobsError({ code: JobsErrorCode.FencedOut, params: { jobId: "job-1", token: 3 } })
        claims.advance.mockRejectedValue(failure)
        const delivery = jest.fn()

        await expect((await build(claims, delivery)).run(job)).rejects.toBe(failure)

        expect(delivery).not.toHaveBeenCalled()
    })

    it("waits for the domain effect after the claim succeeds", async () => {
        const claims = mock<JobClaims>()
        claims.advance.mockResolvedValue(undefined)
        let releaseDelivery: () => void = () => undefined
        const delivery = jest.fn().mockReturnValue(
            new Promise<void>((resolve) => {
                releaseDelivery = resolve
            }),
        )
        let finished = false
        const run = (await build(claims, delivery)).run(job).then(() => {
            finished = true
        })
        await Promise.resolve()

        expect(delivery).toHaveBeenCalledTimes(1)
        expect(finished).toBe(false)
        releaseDelivery()
        await run
        expect(finished).toBe(true)
    })

    it("propagates a rejected domain effect after advancing the step", async () => {
        const claims = mock<JobClaims>()
        claims.advance.mockResolvedValue(undefined)
        const failure = new JobsError({ code: JobsErrorCode.ConnectionMissing })
        const delivery = jest.fn().mockRejectedValue(failure)

        await expect((await build(claims, delivery)).run(job)).rejects.toBe(failure)

        expect(claims.advance).toHaveBeenCalledTimes(1)
    })

    it("propagates a domain effect that throws before returning a promise", async () => {
        const claims = mock<JobClaims>()
        claims.advance.mockResolvedValue(undefined)
        const failure = new JobsError({ code: JobsErrorCode.ConnectionMissing })
        const delivery = (): Promise<void> => {
            throw failure
        }

        await expect((await build(claims, delivery)).run(job)).rejects.toBe(failure)
    })
})
