import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENTS_QUEUE, AgentsJob } from "@modules/queues/agents"
import { GenerateWithAgentStep } from "../../steps/generate-with-agent.step"
import { GenerateWithAgentProcessor } from "./generate-with-agent.processor"

describe("GenerateWithAgentProcessor", () => {
    it("consumes its job of the agents queue and runs the one step", async () => {
        const step = mock<GenerateWithAgentStep>({ run: jest.fn(() => Promise.resolve()) })
        const moduleRef = await Test.createTestingModule({
            providers: [GenerateWithAgentProcessor, { provide: GenerateWithAgentStep, useValue: step }],
        }).compile()
        const processor = moduleRef.get(GenerateWithAgentProcessor)
        const job: ClaimedJob = {
            jobId: "job-1",
            kind: "agents.generate",
            fencingToken: 1,
            currentStep: null,
            payload: {},
        }

        await processor.process(job)

        expect(processor.queue).toBe(AGENTS_QUEUE)
        expect(processor.job).toBe(AgentsJob.Generate)
        expect(step.run).toHaveBeenCalledWith(job)
    })
})
