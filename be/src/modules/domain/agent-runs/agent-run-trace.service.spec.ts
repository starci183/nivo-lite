import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunTraceService } from "./agent-run-trace.service"
import type { RunStepView } from "./agent-runs-engine.contracts"

const step = (seq: number, nodeKey: string): RunStepView => ({
    stepKey: `step-${String(seq)}`,
    nodeKey,
    kind: "tool",
    seq,
    status: "done",
    effect: { kind: "read" },
    attempt: 1,
    errorCode: null,
    result: null,
    waitItemId: null,
    fence: 1,
})

const build = async (run = runViewOf()) => {
    const store = mock<AgentRunStoreService>({
        runOfWake: jest.fn().mockResolvedValue(run),
        stepsOf: jest.fn().mockResolvedValue([step(1, "node-a"), step(2, "node-b")]),
    })
    const container = await Test.createTestingModule({
        providers: [AgentRunTraceService, { provide: AgentRunStoreService, useValue: store }],
    }).compile()
    return { service: container.get(AgentRunTraceService), store }
}

describe("AgentRunTraceService", () => {
    it("lists the steps of a run in order, each with the node key of the graph", async () => {
        const { service, store } = await build()

        const steps = await service.stepsOf("ws-1", "run-1")

        expect(steps.map((entry) => [entry.seq, entry.nodeKey])).toEqual([
            [1, "node-a"],
            [2, "node-b"],
        ])
        expect(store.stepsOf).toHaveBeenCalledWith("ws-1", "run-1")
    })

    it("answers the run of a wake with its steps", async () => {
        const { service } = await build()

        await expect(service.ofWake("ws-1", "wake-1")).resolves.toMatchObject({
            run: { id: "run-1" },
            steps: [{ nodeKey: "node-a" }, { nodeKey: "node-b" }],
        })
    })

    it("answers nothing for a wake that ran on today's prompt and wrote no run", async () => {
        const { service, store } = await build()
        store.runOfWake.mockResolvedValue(null)

        await expect(service.ofWake("ws-1", "wake-2")).resolves.toBeNull()
    })
})
