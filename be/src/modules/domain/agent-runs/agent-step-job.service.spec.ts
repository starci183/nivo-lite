import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunsService } from "./agent-runs.service"
import { AgentRunsErrorCode } from "./errors/agent-runs.error"
import { AgentStepJobService } from "./agent-step-job.service"
import type { RunAdvance } from "./agent-runs-engine.contracts"

const build = async (advance: RunAdvance) => {
    const runs = mock<AgentRunsService>({ advance: jest.fn().mockResolvedValue(advance) })
    const container = await Test.createTestingModule({
        providers: [AgentStepJobService, { provide: AgentRunsService, useValue: runs }],
    }).compile()
    return { service: container.get(AgentStepJobService), runs }
}

describe("AgentStepJobService.run", () => {
    it("drives the run the job names", async () => {
        const { service, runs } = await build({ run: runViewOf(), retryAfterMs: null })

        await expect(service.run({ workspaceId: "ws-1", runId: "run-1" })).resolves.toBeUndefined()

        expect(runs.advance).toHaveBeenCalledWith("run-1", expect.any(AbortSignal))
    })

    it("asks the queue to run the job again when a step is held by its backoff", async () => {
        const { service } = await build({ run: runViewOf(), retryAfterMs: 4200 })

        await expect(service.run({ workspaceId: "ws-1", runId: "run-1" })).rejects.toMatchObject({
            code: AgentRunsErrorCode.StepNotReady,
            params: { retryAfterSeconds: 5 },
        })
    })

    it("bounds the pause it asks for", async () => {
        const short = await build({ run: null, retryAfterMs: 1 })
        const long = await build({ run: null, retryAfterMs: 99_999_999 })

        await expect(short.service.run({ workspaceId: "ws-1", runId: "run-1" })).rejects.toMatchObject({
            params: { retryAfterSeconds: 1 },
        })
        await expect(long.service.run({ workspaceId: "ws-1", runId: "run-1" })).rejects.toMatchObject({
            params: { retryAfterSeconds: 3600 },
        })
    })

    it("ends a job that names no run, with no retry", async () => {
        const { service, runs } = await build({ run: null, retryAfterMs: null })

        await expect(service.run({ workspaceId: "ws-1" })).rejects.toMatchObject({
            code: AgentRunsErrorCode.JobPayloadInvalid,
            params: { unrecoverable: 1 },
        })
        expect(runs.advance).not.toHaveBeenCalled()
    })
})
