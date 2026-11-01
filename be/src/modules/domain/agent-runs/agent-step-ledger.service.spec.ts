import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { stepSpecOf, stepViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentStepLedgerService } from "./agent-step-ledger.service"
import { AgentRunsErrorCode } from "./errors/agent-runs.error"

const call = (name: string, args: number): string =>
    `SELECT * FROM "public"."${name}"(${Array.from({ length: args }, (_, index) => `$${String(index + 1)}`).join(", ")})`

const stepRow = {
    stepId: "s-1",
    runId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    stepKey: "turn",
    nodeKey: "node-turn",
    kind: "turn",
    effect: { kind: "read" },
    input: {},
    status: "running",
    attempt: 1,
    maxAttempts: 3,
    deadlineMs: 1000,
    fence: 5,
    result: null,
    earlier: {},
}

const build = async (em: MockEntityManager) => {
    const queue = mock<AgentStepQueue>({ enqueueAdvance: jest.fn().mockResolvedValue(undefined) })
    const store = mock<AgentRunStoreService>({ appendRows: jest.fn().mockResolvedValue(1) })
    const container = await Test.createTestingModule({
        providers: [
            AgentStepLedgerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentStepQueue, useValue: queue },
            { provide: AgentRunStoreService, useValue: store },
        ],
    }).compile()
    return { service: container.get(AgentStepLedgerService), queue, store, tx: fakeTransaction(em) }
}

const COMMIT = call("agent_step_commit", 10)

describe("AgentStepLedgerService.claim", () => {
    it("claims the named step or the first open one under a new fence", async () => {
        const em = mockEntityManager({
            query: [call("agent_step_claim", 2), [{ agent_step_claim: { result: "claimed", step: stepRow } }]],
        })
        const { service } = await build(em)

        await expect(service.claim("run-1", null)).resolves.toMatchObject({ kind: "claimed", step: { fence: 5 } })
        expect(em.query).toHaveBeenCalledWith(call("agent_step_claim", 2), ["run-1", null])
    })

    it("refuses an answer it cannot read", async () => {
        const em = mockEntityManager({ query: [call("agent_step_claim", 2), [{ agent_step_claim: { result: "?" } }]] })
        const { service } = await build(em)

        await expect(service.claim("run-1", "turn")).rejects.toMatchObject({ code: AgentRunsErrorCode.ResultRejected })
    })
})

describe("AgentStepLedgerService.commit", () => {
    it("stores a done step, the steps that follow and the job of the next advance in one transaction", async () => {
        const em = mockEntityManager({ query: [COMMIT, [{ agent_step_commit: "ok" }]] })
        const { service, queue, store, tx } = await build(em)
        const next = [stepSpecOf({ stepKey: "after" })]

        await expect(service.commit(stepViewOf({ fence: 5 }), { kind: "done", result: { a: 1 }, next })).resolves.toBe("ok")

        expect(store.appendRows).toHaveBeenCalledWith(expect.anything(), { runId: "run-1", workspaceId: "ws-1" }, next)
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "turn",
            "done",
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })

    it("changes nothing when the fence moved on: no next step, no job", async () => {
        const em = mockEntityManager({ query: [COMMIT, [{ agent_step_commit: "fenced" }]] })
        const { service, queue, store } = await build(em)

        await expect(
            service.commit(stepViewOf(), { kind: "done", result: {}, next: [stepSpecOf()] }),
        ).resolves.toBe("fenced")

        expect(store.appendRows).not.toHaveBeenCalled()
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("writes the job that tries a retried step again, keyed by the try", async () => {
        const em = mockEntityManager({ query: [COMMIT, [{ agent_step_commit: "ok" }]] })
        const { service, queue } = await build(em)

        await service.commit(stepViewOf({ attempt: 2 }), { kind: "retry", code: "slow", afterMs: 4000 })

        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "turn",
            "retry-2",
            expect.anything(),
        )
    })

    it("writes no job for a wait or a failure, which the sweep and the route own", async () => {
        const em = mockEntityManager({
            query: [
                [COMMIT, [{ agent_step_commit: "ok" }]],
                [COMMIT, [{ agent_step_commit: "ok" }]],
            ],
        })
        const { service, queue } = await build(em)

        await service.commit(stepViewOf(), { kind: "wait", workItemId: "item-1", deadlineAt: new Date("2026-11-01T10:00:00Z") })
        await service.commit(stepViewOf(), { kind: "failed", code: "x" })

        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("refuses an answer it cannot read", async () => {
        const em = mockEntityManager({ query: [COMMIT, [{ agent_step_commit: "maybe" }]] })
        const { service } = await build(em)

        await expect(service.commit(stepViewOf(), { kind: "failed", code: "x" })).rejects.toMatchObject({
            code: AgentRunsErrorCode.ResultRejected,
        })
    })
})

describe("AgentStepLedgerService.release", () => {
    it("gives the claim back under its fence and says whether it was still the holder", async () => {
        const em = mockEntityManager({ query: [call("agent_step_release", 3), [{ agent_step_release: true }]] })
        const { service } = await build(em)

        await expect(service.release(stepViewOf({ fence: 4 }))).resolves.toBe(true)
        expect(em.query).toHaveBeenCalledWith(call("agent_step_release", 3), ["run-1", "turn", 4])
    })
})

describe("AgentStepLedgerService compensation", () => {
    it("claims the last step still to undo", async () => {
        const em = mockEntityManager({
            query: [call("agent_comp_claim", 2), [{ agent_comp_claim: { result: "claimed", step: stepRow } }]],
        })
        const { service } = await build(em)

        await expect(service.claimCompensation("run-1")).resolves.toMatchObject({ kind: "claimed" })
        expect(em.query).toHaveBeenCalledWith(call("agent_comp_claim", 2), ["run-1", 120])
    })

    it("refuses a claim it cannot read", async () => {
        const em = mockEntityManager({ query: [call("agent_comp_claim", 2), [{ agent_comp_claim: 3 }]] })
        const { service } = await build(em)

        await expect(service.claimCompensation("run-1")).rejects.toMatchObject({
            code: AgentRunsErrorCode.ResultRejected,
        })
    })

    it("commits an undo under the fence with the retry pause and the tries it gets", async () => {
        const em = mockEntityManager({ query: [call("agent_comp_commit", 7), [{ agent_comp_commit: "dead" }]] })
        const { service } = await build(em)

        await expect(service.commitCompensation(stepViewOf({ fence: 9 }), false, "x")).resolves.toBe("dead")
        expect(em.query).toHaveBeenCalledWith(call("agent_comp_commit", 7), ["run-1", "turn", 9, false, "x", 30, 3])
    })

    it("refuses a commit answer it cannot read", async () => {
        const em = mockEntityManager({ query: [call("agent_comp_commit", 7), [{ agent_comp_commit: "?" }]] })
        const { service } = await build(em)

        await expect(service.commitCompensation(stepViewOf(), true, null)).rejects.toMatchObject({
            code: AgentRunsErrorCode.ResultRejected,
        })
    })
})
