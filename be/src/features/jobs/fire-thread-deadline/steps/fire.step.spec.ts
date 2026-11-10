import { mock } from "@starci/jest-preset"
import type { ThreadDeadlinesService } from "@modules/domain/agent-threads"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { FireStep } from "./fire.step"

const job = (payload: object): ClaimedJob => ({ jobId: "job-1", kind: "thread-deadline.fire", fencingToken: 3, currentStep: null, payload })

describe("FireStep.run", () => {
    it("records the step under its token first, then fires the deadline the job carries", async () => {
        const order: Array<string> = []
        const claims = mock<JobClaims>({ advance: jest.fn(() => (order.push("advance"), Promise.resolve())) })
        const deadlines = mock<ThreadDeadlinesService>({ fire: jest.fn(() => (order.push("fire"), Promise.resolve("admitted" as const))) })
        const payload = { workspaceId: "ws-1", runId: "run-1", stepKey: "match", repeats: 1, answered: 0 }

        await new FireStep(claims, deadlines).run(job(payload))

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "fire" })
        expect(deadlines.fire).toHaveBeenCalledWith(payload)
        expect(order).toEqual(["advance", "fire"])
    })

    it("fires nothing for a payload it cannot read", async () => {
        const claims = mock<JobClaims>({ advance: jest.fn().mockResolvedValue(undefined) })
        const deadlines = mock<ThreadDeadlinesService>()

        await new FireStep(claims, deadlines).run(job({ runId: "run-1" }))

        expect(deadlines.fire).not.toHaveBeenCalled()
    })
})
