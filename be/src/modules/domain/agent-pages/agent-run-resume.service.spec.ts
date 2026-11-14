import { Test } from "@nestjs/testing"
import { AgentRunResumeService } from "./agent-run-resume.service"

describe("AgentRunResumeService.resume", () => {
    it("answers thread_run with no step, and resumes nothing", async () => {
        const container = await Test.createTestingModule({ providers: [AgentRunResumeService] }).compile()

        await expect(container.get(AgentRunResumeService).resume()).resolves.toEqual({ kind: "thread_run", stepKey: null })
    })
})
