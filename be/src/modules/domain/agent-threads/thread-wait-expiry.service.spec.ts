import { mock } from "@starci/jest-preset"
import type { AgentRunsService } from "@modules/domain/agent-runs"
import type { GraphThreads } from "@modules/integrations/langgraph"
import type { ThreadDeadlinesService } from "./thread-deadlines.service"
import { ThreadWaitExpiryService } from "./thread-wait-expiry.service"

const WAIT_QUESTION = {
    kind: "wait",
    parkKey: "pay[r1].hold",
    dueAt: "2026-11-15T08:00:00.000Z",
    on: [{ key: "credit", verb: "payment.credit.received" }],
    subject: { conversationId: "conv-1" },
}

const runOf = (id: string) => ({ id, agentId: "agent-1", context: { contactId: "c-1" } })

const setup = (questions: Readonly<Record<string, unknown>>) => {
    const runs = mock<AgentRunsService>()
    runs.parkedAtWait.mockImplementation((_ws, limit) => Promise.resolve(["r1", "r2", "r3"].slice(0, limit).map(runOf) as never))
    const deadlines = mock<ThreadDeadlinesService>()
    deadlines.fireNow.mockResolvedValue("admitted")
    const threads = mock<GraphThreads>()
    threads.stateOf.mockImplementation((ref) =>
        Promise.resolve(
            ref.runId in questions ? ({ status: "stopped", stop: { question: questions[ref.runId] } } as never) : ({ status: "running" } as never),
        ),
    )
    return { runs, deadlines, threads, service: new ThreadWaitExpiryService(runs, deadlines, threads) }
}

describe("ThreadWaitExpiryService (R62 + R66: parked waits, expire now through the real deadline road)", () => {
    it("lists only runs whose thread is parked at a WAIT (a stop for a person is not one), with the park, its triggers and deadline", async () => {
        const { service } = setup({ r1: WAIT_QUESTION, r2: { kind: "approval", stepKey: "x" } })

        await expect(service.parked("ws-1", 10)).resolves.toEqual([
            {
                runId: "r1",
                agentId: "agent-1",
                context: { contactId: "c-1" },
                parkKey: "pay[r1].hold",
                dueAt: "2026-11-15T08:00:00.000Z",
                waitsFor: [{ key: "credit", verb: "payment.credit.received" }],
            },
        ])
    })

    it("is bounded: at most 50 runs are read whatever is asked", async () => {
        const { service, runs } = setup({})
        await service.parked("ws-1", 500)
        expect(runs.parkedAtWait).toHaveBeenCalledWith("ws-1", 50)
    })

    it("expires a parked wait through `fireNow` with the wait's own deadline payload; a run not at a wait answers `closed`", async () => {
        const { service, deadlines } = setup({ r1: WAIT_QUESTION })

        await expect(service.expireNow("ws-1", "r1")).resolves.toBe("admitted")
        expect(deadlines.fireNow).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "r1", stepKey: "pay[r1].hold", repeats: 0, answered: -2 })
        await expect(service.expireNow("ws-1", "r2")).resolves.toBe("closed")
        expect(deadlines.fireNow).toHaveBeenCalledTimes(1)
    })
})
