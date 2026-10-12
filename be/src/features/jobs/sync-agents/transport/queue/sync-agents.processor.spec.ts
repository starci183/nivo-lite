import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENTS_QUEUE, AgentsJob } from "@modules/queues/agents"
import { SyncAgentsStep } from "../../steps/sync-agents.step"
import { SyncAgentsProcessor } from "./sync-agents.processor"

describe("SyncAgentsProcessor", () => {
    it("consumes its job of the agents queue and runs the one step", async () => {
        const step = mock<SyncAgentsStep>({ run: jest.fn(() => Promise.resolve()) })
        const moduleRef = await Test.createTestingModule({
            providers: [SyncAgentsProcessor, { provide: SyncAgentsStep, useValue: step }],
        }).compile()
        const processor = moduleRef.get(SyncAgentsProcessor)
        const job: ClaimedJob = { jobId: "job-1", kind: "agents.sync", fencingToken: 1, currentStep: null, payload: {} }

        await processor.process(job)

        expect(processor.queue).toBe(AGENTS_QUEUE)
        expect(processor.job).toBe(AgentsJob.Sync)
        expect(step.run).toHaveBeenCalledWith(job)
    })
})
