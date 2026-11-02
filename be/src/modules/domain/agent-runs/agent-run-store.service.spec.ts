import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import {
    runRowOf,
    runningWaitRowOf,
    stepRowOf,
    stepSpecOf,
    unboundPlanRunRowOf,
    conflictingPlanRunRowsOf,
    boundPlanRunRowOf,
    unboundCompatiblePlanRowsOf,
    invalidPlanBindingRowsOf,
    linkedStepRowsOf,
} from "@tests/fixtures/builders/agent-runs.builder"
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
const PLAN = {
    planning: true,
    workspaceId: "ws-1",
    agentId: "agent-1",
    wakeId: "wake-1",
    trigger: "tag",
    versionId: "v1",
    context: { message: "Plan context" },
}

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
        expect(em.findOneByOrFail).toHaveBeenCalledWith(AgentRunEntity, {
            wakeId: "wake-1",
            workspaceId: "ws-1",
            agentId: "agent-1",
        })
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
        expect(params?.[1]).toContain(
            JSON.stringify({
                stepKey: "a",
                nodeKey: "node-tool",
                kind: "tool",
                effect: { kind: "read" },
                input: {},
                maxAttempts: 3,
                deadlineMs: 120_000,
            }),
        )
        expect(params?.[1]).toContain(
            JSON.stringify({
                stepKey: "b",
                nodeKey: "node-tool",
                kind: "tool",
                effect: { kind: "read" },
                input: {},
                maxAttempts: 5,
                deadlineMs: 120_000,
            }),
        )
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
    it("reads the wake's run through the supplied producer transaction", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager({ findOneBy: [AgentRunEntity, runRowOf()] })
        const { service } = await build(em)
        await expect(service.runOfWake("wake-1", manager)).resolves.toMatchObject({ id: "run-1" })
        expect(manager.findOneBy).toHaveBeenCalledWith(AgentRunEntity, { wakeId: "wake-1" })
        expect(em.findOneBy).not.toHaveBeenCalled()
    })

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
})

describe("AgentRunStoreService reads", () => {
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
        expect(em.find).toHaveBeenCalledWith(AgentRunStepEntity, {
            where: { runId: "run-1" },
            order: { seq: "ASC" },
            take: 200,
        })
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

describe("AgentRunStoreService planning bind", () => {
    it("first-binds under the run lock and preserves the original inbound facts", async () => {
        const row = unboundPlanRunRowOf()
        const em = mockEntityManager({
            findOneOrFail: [AgentRunEntity, row],
            update: [AgentRunEntity, { affected: 1, raw: [], generatedMaps: [] }],
        })
        em.exists.mockResolvedValue(false)
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service } = await build(em)
        expect(await service.open(em, PLAN)).toMatchObject({ versionId: "v1" })
        expect(em.findOneOrFail).toHaveBeenCalledWith(AgentRunEntity, {
            where: { workspaceId: "ws-1", agentId: "agent-1", wakeId: "wake-1" },
            lock: { mode: "pessimistic_write" },
        })
        expect(em.exists).toHaveBeenCalledWith(AgentRunStepEntity, { where: { runId: row.id } })
        expect(em.update).toHaveBeenCalledWith(
            AgentRunEntity,
            { id: row.id },
            {
                versionId: "v1",
                context: {
                    adapter: "webhook",
                    inbound: { source: "original" },
                    planBinding: {
                        versionId: "v1",
                        trigger: "tag",
                        context: PLAN.context,
                    },
                },
            },
        )
        expect(em.update).toHaveBeenCalledTimes(1)
    })

    it.each(conflictingPlanRunRowsOf())(
        "refuses a conflicting replay without overwriting an established plan",
        async (row) => {
            const em = mockEntityManager({ findOneOrFail: [AgentRunEntity, row] })
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const { service } = await build(em)
            await expect(service.open(em, PLAN)).rejects.toMatchObject({ code: AgentRunsErrorCode.PlanConflict })
            expect(em.update).not.toHaveBeenCalled()
        },
    )
})

describe("AgentRunStoreService planning replay", () => {
    it("returns the original plan binding without rewriting it on an exact replay", async () => {
        const row = boundPlanRunRowOf()
        const em = mockEntityManager({ findOneOrFail: [AgentRunEntity, row] })
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service } = await build(em)

        await expect(service.open(em, PLAN)).resolves.toMatchObject({ versionId: "v1", context: row.context })
        expect(em.update).not.toHaveBeenCalled()
        expect(em.exists).not.toHaveBeenCalled()
    })

    it.each(unboundCompatiblePlanRowsOf())(
        "binds compatible unbound contexts while preserving their existing facts",
        async (row) => {
            const em = mockEntityManager({
                findOneOrFail: [AgentRunEntity, row],
                update: [AgentRunEntity, { affected: 1, raw: [], generatedMaps: [] }],
            })
            em.exists.mockResolvedValue(false)
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const { service } = await build(em)

            await expect(service.open(em, PLAN)).resolves.toMatchObject({ versionId: "v1" })
            expect(em.update).toHaveBeenCalledWith(
                AgentRunEntity,
                { id: row.id },
                {
                    versionId: "v1",
                    context: {
                        ...row.context,
                        planBinding: { versionId: "v1", trigger: "tag", context: PLAN.context },
                    },
                },
            )
        },
    )
})

describe("AgentRunStoreService planning refusals", () => {
    it.each(invalidPlanBindingRowsOf())(
        "refuses malformed or incompatible stored bindings before writing",
        async (row) => {
            const em = mockEntityManager({ findOneOrFail: [AgentRunEntity, row] })
            queueQueryBuilders(em, [{ execute: { raw: [] } }])
            const { service } = await build(em)

            await expect(service.open(em, PLAN)).rejects.toMatchObject({ code: AgentRunsErrorCode.PlanConflict })
            expect(em.update).not.toHaveBeenCalled()
            expect(em.exists).not.toHaveBeenCalled()
        },
    )

    it("refuses a first binding after steps already exist", async () => {
        const em = mockEntityManager({ findOneOrFail: [AgentRunEntity, unboundPlanRunRowOf()] })
        em.exists.mockResolvedValue(true)
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const { service } = await build(em)

        await expect(service.open(em, PLAN)).rejects.toMatchObject({ code: AgentRunsErrorCode.PlanConflict })
        expect(em.exists).toHaveBeenCalledWith(AgentRunStepEntity, { where: { runId: "run-1" } })
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("AgentRunStoreService.linksFor", () => {
    it("returns at most two scoped immutable input links with their full owner and wait facts", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getMany: linkedStepRowsOf() }])
        const { service } = await build(em)

        await expect(service.linksFor("ws-1", "reply", "messageId", "m-1")).resolves.toEqual([
            { kind: "reply", agentId: "agent-1", status: "running", waitItemId: "item-1", input: { messageId: "m-1" } },
            { kind: "reply", agentId: "agent-2", status: "done", waitItemId: null, input: { messageId: "m-1" } },
        ])
        expect(query?.callsOf("where")).toEqual([
            ["s.workspace_id = :workspaceId AND s.kind = :kind", { workspaceId: "ws-1", kind: "reply" }],
        ])
        expect(query?.callsOf("andWhere")).toEqual([["s.input ->> :key = :value", { key: "messageId", value: "m-1" }]])
        expect(query?.callsOf("limit")).toEqual([[2]])
    })

    it("returns no links when the scoped consumer key has no match", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getMany: [] }])
        const { service } = await build(em)
        await expect(service.linksFor("ws-1", "reply", "messageId", "missing")).resolves.toEqual([])
    })
})
