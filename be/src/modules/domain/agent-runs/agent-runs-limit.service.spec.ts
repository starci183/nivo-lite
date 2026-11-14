import { Test } from "@nestjs/testing"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { AgentRunsLimitService } from "./agent-runs-limit.service"
import type { AgentRunsOptions } from "./agent-runs.options"

const limitOf = async (options: AgentRunsOptions | null): Promise<AgentRunsLimitService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRunsLimitService, ...(options === null ? [] : [{ provide: AGENT_RUNS_OPTIONS, useValue: options }])],
    }).compile()
    return moduleRef.get(AgentRunsLimitService)
}

describe("AgentRunsLimitService capacity", () => {
    it("is 100 when the app says nothing", async () => {
        expect((await limitOf(null)).concurrency).toBe(100)
        expect((await limitOf({})).concurrency).toBe(100)
    })

    it("takes the one setting of the app", async () => {
        expect((await limitOf({ concurrency: 8 })).concurrency).toBe(8)
    })

    it("falls back to 100 for a setting that is no whole number of at least one, and caps a huge one at 1000", async () => {
        for (const concurrency of [0, -2, 2.5]) expect((await limitOf({ concurrency })).concurrency).toBe(100)
        expect((await limitOf({ concurrency: 5000 })).concurrency).toBe(1000)
    })
})

describe("AgentRunsLimitService per workspace", () => {
    it("lets ONE workspace reach the whole capacity when nothing lowers it (a self-hosted install runs 100 at once)", async () => {
        expect((await limitOf(null)).workspaceConcurrency).toBe(100)
        expect((await limitOf({ concurrency: 40 })).workspaceConcurrency).toBe(40)
    })

    it("is lowered only by its own setting on a shared deployment, and never above the capacity", async () => {
        expect((await limitOf({ workspaceConcurrency: 10 })).workspaceConcurrency).toBe(10)
        expect((await limitOf({ concurrency: 20, workspaceConcurrency: 50 })).workspaceConcurrency).toBe(20)
        expect((await limitOf({ workspaceConcurrency: 0 })).workspaceConcurrency).toBe(100)
    })
})
