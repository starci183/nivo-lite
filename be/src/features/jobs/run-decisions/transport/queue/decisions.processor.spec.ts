import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { DECISIONS_QUEUE, DecisionsJob } from "@modules/queues/decisions"
import { DecisionsStep } from "../../steps/decisions.step"
import { DecisionsProcessor } from "./decisions.processor"

const build = async () => {
    const step = mock<DecisionsStep>({ run: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [DecisionsProcessor, { provide: DecisionsStep, useValue: step }],
    }).compile()
    return { processor: moduleRef.get(DecisionsProcessor), step }
}

describe("DecisionsProcessor", () => {
    it.each([
        DecisionsJob.DecideWork,
        DecisionsJob.DecideExecution,
        DecisionsJob.ProposeCommand,
        DecisionsJob.ConfirmCommand,
    ])("consumes %s from the decisions queue and runs its one step", async (kind) => {
        const { processor, step } = await build()
        const job: ClaimedJob = {
            jobId: "job-1",
            kind,
            fencingToken: 4,
            currentStep: "decide",
            payload: { workspaceId: "workspace-1", userId: "user-1", locale: "vi" },
        }

        await processor.process(job)

        expect(processor.queue).toBe(DECISIONS_QUEUE)
        expect(processor.job).toBeUndefined()
        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(job)
    })

    it("propagates the step failure to the queue worker", async () => {
        const { processor, step } = await build()
        const job: ClaimedJob = {
            jobId: "job-2",
            kind: DecisionsJob.ConfirmCommand,
            fencingToken: 2,
            currentStep: null,
            payload: { candidateId: "candidate-1" },
        }
        const failed = new Error("step failed")
        step.run.mockRejectedValue(failed)

        await expect(processor.process(job)).rejects.toBe(failed)

        expect(step.run).toHaveBeenCalledTimes(1)
        expect(step.run).toHaveBeenCalledWith(job)
    })
})
