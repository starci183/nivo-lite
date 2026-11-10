import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { AgentStepQueue } from "@modules/queues/agent-step"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunReportService } from "./agent-run-report.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import {
    OPEN,
    WHEN,
    runRecordOf,
    runRowOf,
    stepRecordOf,
    stepSpecOf,
} from "@tests/fixtures/builders/agent-runs.builder"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })

const spec = (stepKey: string, input: Record<string, unknown> = {}) => stepSpecOf({ stepKey, input })

const build = async () => {
    const em: MockEntityManager = mockEntityManager()
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_ws, work) => work(scoped))
    engine.within.mockImplementation((_manager, _ws, work) => work(scoped))
    const records = mock<AgentRunRecordsService>()
    const queue = mock<AgentStepQueue>()
    const report = mock<AgentRunReportService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunStoreService,
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: records },
            { provide: AgentStepQueue, useValue: queue },
            { provide: AgentRunReportService, useValue: report },
        ],
    }).compile()
    return { store: moduleRef.get(AgentRunStoreService), engine, records, queue, report, em }
}

describe("AgentRunStoreService open", () => {
    it("inserts the run of a wake that has none", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(null)
        records.insertRun.mockResolvedValue({ ok: true, row: runRowOf(), version: "1" })
        await expect(store.open(em, OPEN)).resolves.toMatchObject({ id: "run-1", status: "running" })
        expect(records.insertRun).toHaveBeenCalledWith(
            scoped,
            expect.objectContaining({ wakeId: "wake-1", planning: false, status: "running", stepSeq: 0 }),
        )
    })

    it("answers the run a wake already has, so a replay opens none", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(runRecordOf())
        await store.open(em, OPEN)
        expect(records.insertRun).not.toHaveBeenCalled()
    })

    it("reads the run again when a racing open took the wake first, and refuses any other refusal", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf())
        records.insertRun.mockResolvedValue({
            ok: false,
            reason: "taken",
            constraint: "wake_planning_key",
            refusal: "x",
        })
        await expect(store.open(em, OPEN)).resolves.toMatchObject({ id: "run-1" })
        records.runOfWake.mockReset().mockResolvedValue(null)
        await expect(store.open(em, OPEN)).rejects.toMatchObject({ code: "AGENT_RUNS_RESULT_REJECTED" })
        records.runOfWake.mockReset().mockResolvedValue(null)
        records.insertRun.mockResolvedValue({ ok: false, reason: "invalid" })
        await expect(store.open(em, OPEN)).rejects.toMatchObject({ code: "AGENT_RUNS_RESULT_REJECTED" })
    })

    it("refuses a context JSON cannot carry", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(null)
        await expect(store.open(em, { ...OPEN, context: { bad: () => 1 } })).rejects.toMatchObject({
            code: "AGENT_RUNS_RESULT_REJECTED",
        })
    })
})

const planOpen = (store: AgentRunStoreService, em: MockEntityManager) => store.open(em, { ...OPEN, planning: true })

const planOf = (graphVersionId: string, versionId: string, trigger: string) => ({
    graphVersionId,
    context: { planBinding: { versionId, trigger } },
})

const CONFLICT = { code: "AGENT_RUNS_PLAN_CONFLICT" }

describe("AgentRunStoreService open with a plan", () => {
    it("binds the plan of an unbound run once, keeping its original context", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(runRecordOf({ context: { adapter: "webhook" } }))
        records.stepsOf.mockResolvedValue([])
        records.patchRun.mockResolvedValue(runRecordOf({ planning: true, graphVersionId: "v-1" }))
        await planOpen(store, em)
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), {
            graphVersionId: "v-1",
            planning: true,
            context: {
                adapter: "webhook",
                planBinding: { versionId: "v-1", trigger: "tag", context: { conversationId: "c-1" } },
            },
        })
    })

    it("answers a replay of the same bound plan", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(runRecordOf(planOf("v-1", "v-1", "tag")))
        await expect(planOpen(store, em)).resolves.toMatchObject({ id: "run-1" })
    })

    it("refuses a run that belongs to another plan, and an unbound run whose counter moved", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(runRecordOf(planOf("v-2", "v-1", "tag")))
        await expect(planOpen(store, em)).rejects.toMatchObject(CONFLICT)
        records.runOfWake.mockResolvedValue(runRecordOf({ stepSeq: 2 }))
        await expect(planOpen(store, em)).rejects.toMatchObject(CONFLICT)
    })

    it("refuses to bind a plan after steps began, and when another writer moved the run", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf()])
        await expect(planOpen(store, em)).rejects.toMatchObject(CONFLICT)
        records.stepsOf.mockResolvedValue([])
        records.patchRun.mockResolvedValue(null)
        await expect(planOpen(store, em)).rejects.toMatchObject({ code: "AGENT_RUNS_RUN_CONTENDED" })
    })
})

const ref = { runId: "run-1", workspaceId: "ws-1" }

const arrange = (store: ReturnType<typeof mock<AgentRunRecordsService>>, run = runRecordOf()): void => {
    store.stepsOf.mockResolvedValue([stepRecordOf({ stepKey: "old" })])
    store.run.mockResolvedValue(run)
    store.patchRun.mockResolvedValue({ ...run, stepSeq: run.stepSeq + 2 })
    store.insertStep.mockResolvedValue({ ok: true, row: runRowOf(), version: "1" })
}

describe("AgentRunStoreService append", () => {
    it("writes nothing for no spec and nothing for steps already there", async () => {
        const { store, records, em } = await build()
        arrange(records)
        await expect(store.appendRows(em, ref, [])).resolves.toBe(0)
        await expect(store.appendRows(em, ref, [spec("old")])).resolves.toBe(0)
        expect(records.patchRun).not.toHaveBeenCalled()
    })

    it("reserves ordinals on the run's counter, then writes the steps in order with their budget and link", async () => {
        const { store, records, em } = await build()
        arrange(records)
        const written = await store.appendRows(em, ref, [spec("a", { workItemId: "item-9" }), spec("b")])
        expect(written).toBe(2)
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), { stepSeq: 2 })
        expect(records.insertStep).toHaveBeenNthCalledWith(
            1,
            scoped,
            "run-1",
            expect.objectContaining({
                ordinal: 1,
                stepKey: "a",
                status: "pending",
                workItemId: "item-9",
                maxAttempts: 3,
            }),
        )
        expect(records.insertStep).toHaveBeenNthCalledWith(
            2,
            scoped,
            "run-1",
            expect.objectContaining({ ordinal: 2, stepKey: "b" }),
        )
    })

    it("wakes a waiting run when it takes a step", async () => {
        const { store, records, em } = await build()
        arrange(records, runRecordOf({ status: "waiting" }))
        await store.appendRows(em, ref, [spec("a")])
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), { stepSeq: 1, status: "running" })
    })

    it("takes no step into a run that has ended or been given away", async () => {
        const { store, records, em } = await build()
        arrange(records, runRecordOf({ status: "parked" }))
        await expect(store.appendRows(em, ref, [spec("a")])).resolves.toBe(0)
        expect(records.insertStep).not.toHaveBeenCalled()
    })

    it("refuses a step past the most a run holds", async () => {
        const { store, records, em } = await build()
        arrange(records, runRecordOf({ stepSeq: 100 }))
        await expect(store.appendRows(em, ref, [spec("a")])).rejects.toMatchObject({ code: "AGENT_RUNS_RUN_TOO_LONG" })
    })
})

describe("AgentRunStoreService append refusals and the job", () => {
    it("skips a step another writer took first and refuses any other refusal", async () => {
        const { store, records, em } = await build()
        arrange(records)
        records.insertStep.mockResolvedValueOnce({
            ok: false,
            reason: "taken",
            constraint: "run_step_key",
            refusal: "x",
        })
        await expect(store.appendRows(em, ref, [spec("a"), spec("b")])).resolves.toBe(1)
        records.insertStep.mockResolvedValue({ ok: false, reason: "invalid" })
        await expect(store.appendRows(em, ref, [spec("c")])).rejects.toMatchObject({
            code: "AGENT_RUNS_RESULT_REJECTED",
        })
    })

    it("writes the job that drives the first step in the same transaction, only when a step was written", async () => {
        const { store, records, queue, em } = await build()
        arrange(records)
        await expect(store.append(em, ref, [spec("a")])).resolves.toBe(1)
        expect(queue.enqueueAdvance).toHaveBeenCalledWith({ workspaceId: "ws-1", runId: "run-1" }, "a", "append", em)
        queue.enqueueAdvance.mockClear()
        await store.append(em, ref, [])
        await store.append(em, ref, [spec("old")])
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })
})

describe("AgentRunStoreService scope, patchRunWith and settleIn", () => {
    it("joins the caller's transaction when it holds one and opens its own when it does not", async () => {
        const { store, engine, em } = await build()
        await store.at("ws-1", em, () => Promise.resolve(1))
        await store.at("ws-1", undefined, () => Promise.resolve(1))
        expect(engine.within).toHaveBeenCalledWith(em, "ws-1", expect.any(Function))
        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
    })

    it("builds again from a fresh read when another writer moved the run", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf({ status: "done" }))
        const build_ = jest.fn().mockReturnValue({ status: "done" })
        await expect(store.patchRunWith(scoped, "run-1", build_)).resolves.toMatchObject({ status: "done" })
        expect(build_).toHaveBeenCalledTimes(2)
    })

    it("writes nothing when the builder asks for no write, and tells the caller to try again past the tries", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValue(null)
        await expect(store.patchRunWith(scoped, "run-1", () => null)).resolves.toBeNull()
        await expect(store.patchRunWith(scoped, "run-1", () => ({ status: "done" }))).rejects.toMatchObject({
            code: "AGENT_RUNS_RUN_CONTENDED",
        })
    })

    it("refuses a run that is not there", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(null)
        await expect(store.patchRunWith(scoped, "run-1", () => ({ status: "done" }))).rejects.toMatchObject({
            code: "AGENT_RUNS_RESULT_REJECTED",
        })
    })

    it("settles the run's status from its steps: done with an end time, or running, or only a bump on a closed run", async () => {
        const { store, records } = await build()
        records.patchRun.mockResolvedValue(runRecordOf())
        records.run.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf()])
        await store.settleIn(scoped, "run-1", false)
        expect(records.patchRun).toHaveBeenLastCalledWith(scoped, expect.anything(), {
            status: "done",
            endedAt: WHEN.toISOString(),
        })
        await store.settleIn(scoped, "run-1", true)
        expect(records.patchRun).toHaveBeenLastCalledWith(scoped, expect.anything(), { status: "running" })
        records.run.mockResolvedValue(runRecordOf({ status: "parked", stepSeq: 4 }))
        await store.settleIn(scoped, "run-1", false)
        expect(records.patchRun).toHaveBeenLastCalledWith(scoped, expect.anything(), { stepSeq: 4 })
    })
})

describe("AgentRunStoreService report on the end of a run", () => {
    it("hands the end to the report once, in the scope's transaction, for any write that takes the run to done", async () => {
        const { store, records, report } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "running" }))
        records.patchRun.mockResolvedValue(runRecordOf({ status: "done" }))
        await store.patchRunWith(scoped, "run-1", () => ({ status: "done" }))
        expect(report.ended).toHaveBeenCalledTimes(1)
        expect(report.ended).toHaveBeenCalledWith(scoped.manager, "ws-1", runRecordOf({ status: "done" }))
    })

    it("hands over nothing while the run goes on, and nothing when a run that was done is written again", async () => {
        const { store, records, report } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf()])
        records.patchRun.mockResolvedValue(runRecordOf({ status: "running" }))
        await store.settleIn(scoped, "run-1", true)
        records.run.mockResolvedValue(runRecordOf({ status: "done" }))
        records.patchRun.mockResolvedValue(runRecordOf({ status: "done" }))
        await store.patchRunWith(scoped, "run-1", () => ({ stepSeq: 9 }))
        expect(report.ended).not.toHaveBeenCalled()
    })
})

describe("AgentRunStoreService reads", () => {
    it("reads the run of a wake, the run by id and through a transaction", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValueOnce(runRecordOf()).mockResolvedValueOnce(null)
        records.run
            .mockResolvedValueOnce(runRecordOf())
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(runRecordOf())
        await expect(store.runOfWake("ws-1", "wake-1")).resolves.toMatchObject({ wakeId: "wake-1" })
        await expect(store.runOfWake("ws-1", "wake-2", em)).resolves.toBeNull()
        await expect(store.runById("ws-1", "run-1")).resolves.toMatchObject({ id: "run-1" })
        await expect(store.runById("ws-1", "run-2")).resolves.toBeNull()
        await expect(store.runIn(em, "ws-1", "run-1")).resolves.toMatchObject({ id: "run-1" })
    })

    it("reads the steps of a run as handlers, trace rows, route rows and one step", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf({ stepKey: "a" }), stepRecordOf({ stepKey: "b", ordinal: 2 })])
        await expect(store.viewsOf("ws-1", "run-1")).resolves.toHaveLength(2)
        await expect(store.stepsOf("ws-1", "run-1")).resolves.toHaveLength(2)
        await expect(store.routeStepsOf("ws-1", "run-1")).resolves.toMatchObject([{ stepKey: "a" }, { stepKey: "b" }])
        await expect(store.stepOf("ws-1", "run-1", "b")).resolves.toMatchObject({ stepKey: "b" })
        await expect(store.stepOf("ws-1", "run-1", "zz")).resolves.toBeNull()
        records.run.mockResolvedValue(null)
        await expect(store.viewsOf("ws-1", "run-1")).resolves.toEqual([])
    })

    it("lists the open waits of the workspace, the oldest deadline first", async () => {
        const { store, records } = await build()
        records.stepsOfStatus.mockResolvedValue([stepRecordOf({ waitItemId: "item-1", status: "running" })])
        records.run.mockResolvedValue(runRecordOf())
        await expect(store.openWaits("ws-1", 5)).resolves.toMatchObject([{ waitItemId: "item-1" }])
        expect(records.stepsOfStatus).toHaveBeenCalledWith(
            scoped,
            "running",
            { op: "notNull", field: "waitItemId" },
            [
                ["claimedUntil", "asc"],
                ["id", "asc"],
            ],
            5,
        )
    })

    it("finds the links of a work item with the owner agent of each, and refuses any other key", async () => {
        const { store, records } = await build()
        records.stepsAbout.mockResolvedValue([stepRecordOf({ kind: "approval", input: { workItemId: "item-1" } })])
        records.run.mockResolvedValue(runRecordOf({ agentId: "agent-7" }))
        await expect(store.linksFor("ws-1", "approval", "workItemId", "item-1")).resolves.toEqual([
            { kind: "approval", agentId: "agent-7", status: "done", waitItemId: null, input: { workItemId: "item-1" } },
        ])
        await expect(store.linksFor("ws-1", "approval", "messageId", "m-1")).rejects.toMatchObject({
            code: "AGENT_RUNS_LINK_KEY_UNSUPPORTED",
        })
    })

    it("reads the step that waits on a work item as its handler reads it, or null", async () => {
        const { store, records, em } = await build()
        records.stepsWaitingOn.mockResolvedValueOnce([stepRecordOf({ status: "running", waitItemId: "item-1" })])
        records.run.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf({ status: "running", waitItemId: "item-1" })])
        await expect(store.waitingOn("ws-1", "item-1", em)).resolves.toMatchObject({ stepKey: "step-1", fence: 2 })
        records.stepsWaitingOn.mockResolvedValueOnce([stepRecordOf({ status: "done" })])
        await expect(store.waitingOn("ws-1", "item-1")).resolves.toBeNull()
    })
})

describe("AgentRunStoreService resume", () => {
    const waiting = stepRecordOf({ status: "running", waitItemId: "item-1" })

    it("finishes the step that waits, writes what follows and the job that drives it", async () => {
        const { store, records, queue, em } = await build()
        records.stepsWaitingOn.mockResolvedValue([waiting])
        records.patchStep.mockResolvedValue(stepRecordOf())
        records.stepsOf.mockResolvedValue([stepRecordOf()])
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValue(runRecordOf())
        records.insertStep.mockResolvedValue({ ok: true, row: runRowOf(), version: "1" })
        await expect(
            store.resume(em, "ws-1", "item-1", { result: { approved: true }, next: [spec("after")] }),
        ).resolves.toBe(true)
        expect(records.patchStep).toHaveBeenCalledWith(
            scoped,
            waiting,
            expect.objectContaining({ status: "done", result: { approved: true }, waitItemId: null }),
        )
        expect(records.insertStep).toHaveBeenCalledWith(scoped, "run-1", expect.objectContaining({ stepKey: "after" }))
        expect(queue.enqueueAdvance).toHaveBeenCalledWith(
            { workspaceId: "ws-1", runId: "run-1" },
            "item-1",
            "resume",
            em,
        )
    })

    it("answers false when no step waits or the step moved on first", async () => {
        const { store, records, queue, em } = await build()
        records.stepsWaitingOn.mockResolvedValueOnce([]).mockResolvedValueOnce([waiting])
        records.run.mockResolvedValue(runRecordOf())
        records.patchStep.mockResolvedValue(null)
        await expect(store.resume(em, "ws-1", "item-1", { result: {}, next: [] })).resolves.toBe(false)
        await expect(store.resume(em, "ws-1", "item-1", { result: {}, next: [] })).resolves.toBe(false)
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })
})

describe("AgentRunStoreService route and spoken", () => {
    it("moves a run from the status read to the one chosen, compensating the named done steps", async () => {
        const { store, records, em } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValue(runRecordOf({ status: "compensating" }))
        records.stepsOf.mockResolvedValue([stepRecordOf({ stepKey: "a" }), stepRecordOf({ stepKey: "b", id: "s-2" })])
        records.patchStep.mockResolvedValue(stepRecordOf())
        await expect(
            store.route("ws-1", "run-1", { from: "running", to: "compensating", code: "boom", compensate: ["a"] }, em),
        ).resolves.toBe(true)
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), {
            status: "compensating",
            error: { code: "boom" },
        })
        expect(records.patchStep).toHaveBeenCalledTimes(1)
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.objectContaining({ stepKey: "a" }), {
            status: "compensating",
            claimedUntil: null,
        })
    })

    it("records why and when a run was parked, and stops with false when another path decided first", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValue(runRecordOf({ status: "parked" }))
        records.stepsOf.mockResolvedValue([])
        await store.route("ws-1", "run-1", { from: "running", to: "parked", code: "boom", compensate: [] })
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), {
            status: "parked",
            error: { code: "boom" },
            parkReason: "boom",
            endedAt: WHEN.toISOString(),
        })
        records.patchRun.mockClear()
        await expect(
            store.route("ws-1", "run-1", { from: "waiting", to: "dead", code: "x", compensate: [] }),
        ).resolves.toBe(false)
        expect(records.patchRun).not.toHaveBeenCalled()
    })

    it("marks a stopped run as told once", async () => {
        const { store, records } = await build()
        records.patchRun.mockResolvedValue(runRecordOf())
        records.run
            .mockResolvedValueOnce(runRecordOf({ status: "parked" }))
            .mockResolvedValueOnce(runRecordOf({ status: "parked", deadLetteredAt: WHEN }))
        records.run.mockResolvedValueOnce(runRecordOf({ status: "running" }))
        await expect(store.spoken("ws-1", "run-1")).resolves.toBe(true)
        await expect(store.spoken("ws-1", "run-1")).resolves.toBe(false)
        await expect(store.spoken("ws-1", "run-1")).resolves.toBe(false)
        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), { deadLetteredAt: WHEN.toISOString() })
    })
})

describe("AgentRunStoreService cancel", () => {
    it("marks a waiting run cancelled with who and when and gives back the claim, the wait and the timer of its running steps", async () => {
        const { store, records } = await build()
        records.patchStep.mockResolvedValue(stepRecordOf())
        records.run.mockResolvedValue(runRecordOf({ status: "waiting" }))
        records.patchRun.mockResolvedValue(runRecordOf({ status: "cancelled" }))
        records.stepsOf.mockResolvedValue([
            stepRecordOf({ stepKey: "sent", status: "done" }),
            stepRecordOf({ stepKey: "wait", id: "s-2", status: "running", waitItemId: "item-1" }),
            stepRecordOf({ stepKey: "later", id: "s-3", status: "pending" }),
        ])

        await expect(store.cancel("ws-1", "run-1", "member-1")).resolves.toEqual({ kind: "cancelled" })

        expect(records.patchRun).toHaveBeenCalledWith(scoped, expect.anything(), {
            status: "cancelled",
            error: { code: "run_cancelled" },
            cancelledBy: "member-1",
            cancelledAt: WHEN.toISOString(),
            endedAt: WHEN.toISOString(),
            waitWorkItemId: null,
            waitDeadlineAt: null,
        })
        expect(records.patchStep).toHaveBeenCalledTimes(1)
        expect(records.patchStep).toHaveBeenCalledWith(scoped, expect.objectContaining({ stepKey: "wait" }), {
            status: "failed",
            errorCode: "run_cancelled",
            claimedUntil: null,
            waitItemId: null,
            endedAt: WHEN.toISOString(),
        })
    })

    it("never undoes what was done: a done step is left alone and none is compensated", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.patchRun.mockResolvedValue(runRecordOf({ status: "cancelled" }))
        records.stepsOf.mockResolvedValue([stepRecordOf({ status: "done", effect: { kind: "pivot" } })])

        await store.cancel("ws-1", "run-1", "member-1")

        expect(records.patchStep).not.toHaveBeenCalled()
    })

    it("answers an already cancelled run, a run that ended or stopped on a failure, and a run that is gone, and changes nothing", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValueOnce(runRecordOf({ status: "cancelled" }))
        await expect(store.cancel("ws-1", "run-1", "member-1")).resolves.toEqual({ kind: "already_cancelled" })
        for (const status of ["done", "failed", "dead", "parked", "compensating", "compensated"] as const) {
            records.run.mockResolvedValue(runRecordOf({ status }))
            await expect(store.cancel("ws-1", "run-1", "member-1")).resolves.toEqual({ kind: "not_cancellable" })
        }
        records.run.mockResolvedValue(null)
        await expect(store.cancel("ws-1", "run-1", "member-1")).resolves.toEqual({ kind: "not_found" })

        expect(records.patchRun).not.toHaveBeenCalled()
        expect(records.patchStep).not.toHaveBeenCalled()
    })
})

describe("AgentRunStoreService: a run on a LangGraph thread is never moved by the old engine", () => {
    const thread = runRecordOf({ engine: "langgraph" })
    const waiting = stepRecordOf({ status: "running", waitItemId: "item-1" })

    it("finds no step waiting on a work item when the step is a thread run's projection", async () => {
        const { store, records, em } = await build()
        records.stepsWaitingOn.mockResolvedValue([waiting])
        records.run.mockResolvedValue(thread)

        await expect(store.waitingOn("ws-1", "item-1", em)).resolves.toBeNull()
    })

    it("finishes no wait of a thread run and writes no job", async () => {
        const { store, records, queue, em } = await build()
        records.stepsWaitingOn.mockResolvedValue([waiting])
        records.run.mockResolvedValue(thread)

        await expect(store.resume(em, "ws-1", "item-1", { result: {}, next: [] })).resolves.toBe(false)
        expect(records.patchStep).not.toHaveBeenCalled()
        expect(queue.enqueueAdvance).not.toHaveBeenCalled()
    })

    it("lists no open wait of a thread run, and says which runs the old engine drives", async () => {
        const { store, records } = await build()
        records.stepsOfStatus.mockResolvedValue([waiting, stepRecordOf({ runId: "run-2", status: "running", waitItemId: "item-2" })])
        records.run.mockImplementation((_tx, runId) => Promise.resolve(runId === "run-2" ? runRecordOf({ id: "run-2" }) : thread))

        await expect(store.openWaits("ws-1", 5)).resolves.toMatchObject([{ waitItemId: "item-2" }])
        await expect(store.drivesOldEngine("ws-1", "run-1")).resolves.toBe(false)
        await expect(store.drivesOldEngine("ws-1", "run-2")).resolves.toBe(true)
        records.run.mockResolvedValue(null)
        await expect(store.drivesOldEngine("ws-1", "run-9")).resolves.toBe(false)
    })
})
