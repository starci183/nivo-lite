import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GenerationRunnerService } from "@modules/domain/ai-generations"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { GenerateWithAgentStep } from "./generate-with-agent.step"

const JOB: ClaimedJob = {
    jobId: "job-1",
    kind: "agents.generate",
    fencingToken: 3,
    currentStep: null,
    payload: { generationId: "g1", workspaceId: "w1" },
}

const build = async () => {
    const claims = mock<JobClaims>({ advance: jest.fn(() => Promise.resolve()) })
    const runner = mock<GenerationRunnerService>({ run: jest.fn(() => Promise.resolve("done" as const)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            GenerateWithAgentStep,
            { provide: JOB_CLAIMS, useValue: claims },
            { provide: GenerationRunnerService, useValue: runner },
        ],
    }).compile()
    return { step: moduleRef.get(GenerateWithAgentStep), claims, runner }
}

describe("GenerateWithAgentStep", () => {
    it("records the step with its token first and then does the work", async () => {
        const { step, claims, runner } = await build()
        const order: Array<string> = []
        claims.advance.mockImplementation(() => {
            order.push("advance")
            return Promise.resolve()
        })
        runner.run.mockImplementation(() => {
            order.push("work")
            return Promise.resolve("done" as const)
        })

        await step.run(JOB)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 3, step: "generate" })
        expect(runner.run).toHaveBeenCalledWith(JOB.payload)
        expect(order).toEqual(["advance", "work"])
    })

    it("does no work when the token is stale", async () => {
        const { step, claims, runner } = await build()
        const fenced = new Error("fenced out")
        claims.advance.mockRejectedValue(fenced)

        await expect(step.run(JOB)).rejects.toBe(fenced)
        expect(runner.run).not.toHaveBeenCalled()
    })
})
