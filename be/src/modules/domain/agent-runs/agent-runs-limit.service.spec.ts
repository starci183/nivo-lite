import { Test } from "@nestjs/testing"
import { AGENT_RUNS_OPTIONS } from "./agent-runs.decorators"
import { AgentRunsLimitService } from "./agent-runs-limit.service"
import type { AgentRunsOptions } from "./agent-runs.options"

const limitOf = async (options: AgentRunsOptions | null): Promise<number> => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentRunsLimitService, ...(options === null ? [] : [{ provide: AGENT_RUNS_OPTIONS, useValue: options }])],
    }).compile()
    return moduleRef.get(AgentRunsLimitService).concurrency
}

describe("AgentRunsLimitService", () => {
    it("is 4 when the app says nothing", async () => {
        await expect(limitOf(null)).resolves.toBe(4)
        await expect(limitOf({})).resolves.toBe(4)
    })

    it("takes the setting of the app", async () => {
        await expect(limitOf({ concurrency: 8 })).resolves.toBe(8)
    })

    it("falls back to 4 for a setting that is no whole number of at least one, and caps a huge one", async () => {
        await expect(limitOf({ concurrency: 0 })).resolves.toBe(4)
        await expect(limitOf({ concurrency: -2 })).resolves.toBe(4)
        await expect(limitOf({ concurrency: 2.5 })).resolves.toBe(4)
        await expect(limitOf({ concurrency: 5000 })).resolves.toBe(64)
    })
})
