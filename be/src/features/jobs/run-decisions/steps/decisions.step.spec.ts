import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { DecisionsQueueService } from "@modules/domain/office-command-candidates"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { DecisionsJob } from "@modules/queues/decisions"
import { DecisionsStep } from "./decisions.step"

const JOB: ClaimedJob = {
    jobId: "job-1",
    kind: DecisionsJob.DecideWork,
    fencingToken: 3,
    currentStep: null,
    payload: {
        workspaceId: "workspace-1",
        userId: "user-1",
        locale: "en",
        workItemId: "work-1",
        decision: "approved",
    },
}

const build = async () => {
    const claims = mock<JobClaims>({ advance: jest.fn(() => Promise.resolve()) })
    const queue = mock<DecisionsQueueService>({ handle: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            DecisionsStep,
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: DecisionsQueueService, useValue: queue },
        ],
    }).compile()
    return { step: moduleRef.get(DecisionsStep), claims, queue }
}

describe("DecisionsStep", () => {
    it("records the decide step with the claim token before handling the exact payload", async () => {
        const { step, claims, queue } = await build()
        const order: Array<string> = []
        claims.advance.mockImplementation(() => {
            order.push("advance")
            return Promise.resolve()
        })
        queue.handle.mockImplementation(() => {
            order.push("handle")
            return Promise.resolve()
        })

        await step.run(JOB)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "decide" })
        expect(queue.handle).toHaveBeenCalledTimes(1)
        expect(queue.handle).toHaveBeenCalledWith(JOB.payload)
        expect(order).toEqual(["advance", "handle"])
    })

    it("does no work and propagates the advance failure when the claim token is stale", async () => {
        const { step, claims, queue } = await build()
        const fenced = new Error("fenced out")
        claims.advance.mockRejectedValue(fenced)

        await expect(step.run(JOB)).rejects.toBe(fenced)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "decide" })
        expect(queue.handle).not.toHaveBeenCalled()
    })

    it("propagates a failure from handling the payload after advancing the step", async () => {
        const { step, claims, queue } = await build()
        const failed = new Error("decision failed")
        queue.handle.mockRejectedValue(failed)

        await expect(step.run(JOB)).rejects.toBe(failed)

        expect(claims.advance).toHaveBeenCalledTimes(1)
        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "decide" })
        expect(queue.handle).toHaveBeenCalledTimes(1)
        expect(queue.handle).toHaveBeenCalledWith(JOB.payload)
    })
})
