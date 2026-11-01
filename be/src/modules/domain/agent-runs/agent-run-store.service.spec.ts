import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { runRowOf, runningWaitRowOf, stepRowOf, stepSpecOf } from "@tests/fixtures/builders/agent-runs.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunStoreService } from "./agent-run-store.service"
import { AgentRunsErrorCode } from "./errors/agent-runs.error"
import { AgentRunEntity, AgentRunStepEntity } from "./persistence/entities"

const call = (name: string, args: number): string =>
    `SELECT * FROM "public"."${name}"(${Array.from({ length: args }, (_, index) => `$${String(index + 1)}`).join(", ")})`

const stepRow = (seq: number, over: Partial<AgentRunStepEntity> = {}): AgentRunStepEntity =>
    stepRowOf({ id: `s-${String(seq)}`, seq, stepKey: `step-${String(seq)}`, ...over })

const build = async (em: MockEntityManager) => {
    const queue = mock<AgentStepQueue>({ enqueueAdvance: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentRunStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentStepQueue, useValue: queue },
        ],
    }).compile()
    return { service: container.get(AgentRunStoreService), queue }
}

const REF = { runId: "run-1", workspaceId: "ws-1" }

describe("AgentRunStoreService.open", () => {
    it("inserts the run once and answers the run of the wake", async () => {
        const em = mockEntityManager({ findOneByOrFail: [AgentRunEntity, runRowOf()] })
        const [insert] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service } = await build(em)

        const run = await service.open(em, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "customer_message",
            versionId: null,
            context: { conversationId: "c-1" },
        })

        expect(run).toMatchObject({ id: "run-1", wakeId: "wake-1", status: "running" })
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentRunEntity, { wakeId: "wake-1" })
    })
})

describe("AgentRunStoreService.append", () => {
    it("writes the steps with their budgets filled and the job that drives them, together", async () => {
        const em = mockEntityManager({ query: [call("agent_run_append", 2), [{ agent_run_append: 2 }]] })
        const { service, queue } = await build(em)
        const specs = [stepSpecOf({ stepKey: "a" }), stepSpecOf({ stepKey: "b", maxAttempts: 5 })]

        await expect(service.append(em, REF, specs)).resolves.toBe(2)

        const [, params] = em.query.mock.calls[0] ?? []
        expect(params?.[0]).toBe("run-1")
        expect(params?.[1]).toContain(JSON.stringify({ stepKey: "a", nodeKey: "node-tool", kind: "tool", effect: { kind: "read" }, input: {}, maxAttempts: 3, deadlineMs: 120_000 }))
        expect(params?.[1]).toContain(JSON.stringify({ stepKey: "b", nodeKey: "node-tool", kind: "tool", effect: { kind: "read" }, input: {}, maxAttempts: 5, deadlineMs: 120_000 }))
        expect(queue.enqueueAdvance).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1" }, "a", "append", em)
    })

    it("writes no job when every step key was already there", async () => {
        const em = mockEntityManager({ query: [call("agent_run_append", 2), [{ agent_run_append: 0 }]] })
        const { service, queue } = await build(em)

        await expect(service.append(em, REF, [stepSpecOf()])).resolves.toBe(0)
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("writes nothing for no steps", async () => {
        const em = mockEntityManager()
        const { service, queue } = await build(em)

        await expect(service.append(em, REF, [])).resolves.toBe(0)
        await expect(service.appendRows(em, REF, [])).resolves.toBe(0)
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("refuses an answer that is not a count", async () => {
        const em = mockEntityManager({ query: [call("agent_run_append", 2), [{ agent_run_append: "x" }]] })
        const { service } = await build(em)

        await expect(service.appendRows(em, REF, [stepSpecOf()])).rejects.toMatchObject({
            code: AgentRunsErrorCode.ResultRejected,
        })
    })
})

describe("AgentRunStoreService.resume", () => {
    it("finishes the waiting step, writes the steps that follow and one job, in the caller's transaction", async () => {
        const em = mockEntityManager({
            query: [
                [call("agent_step_resume", 3), [{ agent_step_resume: { result: "resumed", runId: "run-1" } }]],
                [call("agent_run_append", 2), [{ agent_run_append: 1 }]],
            ],
            findOneByOrFail: [AgentRunEntity, runRowOf()],
        })
        const { service, queue } = await build(em)

        await expect(
            service.resume(em, "item-1", { result: { outcome: "approved" }, next: [stepSpecOf({ stepKey: "after" })] }),
        ).resolves.toBe(true)

        expect(em.query).toHaveBeenNthCalledWith(1, call("agent_step_resume", 3), [
            "item-1",
            JSON.stringify({ outcome: "approved" }),
            true,
        ])
        expect(queue.enqueueAdvance).toHaveBeenCalledTimes(1)
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "item-1",
            "resume",
            em,
        )
    })

    it("answers false and writes nothing when no step waits on the item", async () => {
        const em = mockEntityManager({
            query: [call("agent_step_resume", 3), [{ agent_step_resume: { result: "none" } }]],
        })
        const { service, queue } = await build(em)

        await expect(service.resume(em, "item-9", { result: {}, next: [] })).resolves.toBe(false)
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("refuses an answer that is not an object", async () => {
        const em = mockEntityManager({ query: [call("agent_step_resume", 3), [{ agent_step_resume: null }]] })
        const { service } = await build(em)

        await expect(service.resume(em, "item-1", { result: {}, next: [] })).rejects.toMatchObject({
            code: AgentRunsErrorCode.ResultRejected,
        })
    })
})

describe("AgentRunStoreService reads", () => {
    it("finds the run of a wake, or none", async () => {
        const em = mockEntityManager({
            findOneBy: [
                [AgentRunEntity, runRowOf()],
                [AgentRunEntity, null],
            ],
        })
        const { service } = await build(em)

        await expect(service.runOfWake("wake-1")).resolves.toMatchObject({ id: "run-1" })
        await expect(service.runOfWake("wake-2")).resolves.toBeNull()
    })

    it("finds a run by id, or none", async () => {
        const em = mockEntityManager({
            findOneBy: [
                [AgentRunEntity, runRowOf()],
                [AgentRunEntity, null],
            ],
        })
        const { service } = await build(em)

        await expect(service.runById("run-1")).resolves.toMatchObject({ id: "run-1" })
        await expect(service.runById("run-2")).resolves.toBeNull()
    })

    it("reads a run in a transaction", async () => {
        const em = mockEntityManager({ findOneByOrFail: [AgentRunEntity, runRowOf({ status: "waiting" })] })
        const { service } = await build(em)

        await expect(service.runIn(em, "run-1")).resolves.toMatchObject({ status: "waiting" })
    })

    it("lists the steps in order for the trace, the failure route and the handlers", async () => {
        const steps = [stepRow(1), stepRow(2, { status: "failed" })]
        const em = mockEntityManager({
            find: [
                [AgentRunStepEntity, steps],
                [AgentRunStepEntity, steps],
                [AgentRunStepEntity, steps],
            ],
        })
        const { service } = await build(em)

        const trace = await service.stepsOf(em, "run-1")
        const route = await service.routeStepsOf(em, "run-1")
        const views = await service.viewsOf("run-1")

        expect(trace.map((step) => step.stepKey)).toEqual(["step-1", "step-2"])
        expect(route).toEqual([
            { stepKey: "step-1", seq: 1, status: "done", effect: { kind: "read" } },
            { stepKey: "step-2", seq: 2, status: "failed", effect: { kind: "read" } },
        ])
        expect(views[1]).toMatchObject({ status: "failed", runId: "run-1" })
        expect(em.find).toHaveBeenCalledWith(AgentRunStepEntity, { where: { runId: "run-1" }, order: { seq: "ASC" }, take: 200 })
    })

    it("finds one step, or none", async () => {
        const em = mockEntityManager({
            findOneBy: [
                [AgentRunStepEntity, stepRow(1)],
                [AgentRunStepEntity, null],
            ],
        })
        const { service } = await build(em)

        await expect(service.stepOf("run-1", "step-1")).resolves.toMatchObject({ stepKey: "step-1" })
        await expect(service.stepOf("run-1", "nope")).resolves.toBeNull()
    })
})

describe("AgentRunStoreService waits", () => {
    it("lists the open waits and finds the step that waits on an item as its handler reads it", async () => {
        const waiting = runningWaitRowOf()
        const em = mockEntityManager({
            find: [
                [AgentRunStepEntity, [waiting]],
                [AgentRunStepEntity, [stepRow(1), waiting]],
                [AgentRunStepEntity, []],
            ],
            findOneBy: [
                [AgentRunStepEntity, waiting],
                [AgentRunStepEntity, waiting],
                [AgentRunStepEntity, null],
            ],
        })
        const { service } = await build(em)

        await expect(service.openWaits(50)).resolves.toMatchObject([{ stepKey: "step-2", waitItemId: "item-1" }])
        await expect(service.waitingOn(em, "item-1")).resolves.toMatchObject({ stepKey: "step-2", earlier: {} })
        await expect(service.waitingOn(em, "item-1")).resolves.toBeNull()
        await expect(service.waitingOn(em, "item-9")).resolves.toBeNull()
    })
})

describe("AgentRunStoreService writes through functions", () => {
    it("moves a run to the status a policy chose, with the steps to undo", async () => {
        const em = mockEntityManager({
            query: [
                [call("agent_run_route", 5), [{ agent_run_route: true }]],
                [call("agent_run_route", 5), [{ agent_run_route: false }]],
            ],
        })
        const { service } = await build(em)
        const move = { from: "running", to: "compensating", code: "x", compensate: ["b", "a"] }

        await expect(service.route(em, "run-1", move)).resolves.toBe(true)
        await expect(service.route(em, "run-1", move)).resolves.toBe(false)
        expect(em.query).toHaveBeenCalledWith(call("agent_run_route", 5), [
            "run-1",
            "running",
            "compensating",
            "x",
            ["b", "a"],
        ])
    })

    it("marks a run told once", async () => {
        const em = mockEntityManager({
            query: [
                [call("agent_run_spoken", 1), [{ agent_run_spoken: true }]],
                [call("agent_run_spoken", 1), [{ agent_run_spoken: false }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.spoken("run-1")).resolves.toBe(true)
        await expect(service.spoken("run-1")).resolves.toBe(false)
    })

    it("lists what the sweep must look at, and refuses rows it cannot read", async () => {
        const row = {
            due_kind: "ready",
            due_run: "run-1",
            due_workspace: "ws-1",
            due_agent: "agent-1",
            due_step: "a",
            due_fence: 0,
            due_at: new Date("2026-11-01T10:00:00Z"),
        }
        const em = mockEntityManager({
            query: [
                [call("agent_run_due", 1), [row]],
                [call("agent_run_due", 1), [{ due_kind: "weird" }]],
            ],
        })
        const { service } = await build(em)

        await expect(service.due(50)).resolves.toMatchObject([{ kind: "ready", runId: "run-1" }])
        await expect(service.due(50)).rejects.toMatchObject({ code: AgentRunsErrorCode.ResultRejected })
    })
})
