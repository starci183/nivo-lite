import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { OPEN, WHEN, runRecordOf, runRowOf, stepRecordOf } from "@tests/fixtures/builders/agent-runs.builder"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })

const build = async () => {
    const em: MockEntityManager = mockEntityManager()
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_ws, work) => work(scoped))
    engine.within.mockImplementation((_manager, _ws, work) => work(scoped))
    const records = mock<AgentRunRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunStoreService,
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return { store: moduleRef.get(AgentRunStoreService), engine, records, em }
}

describe("AgentRunStoreService open", () => {
    it("inserts the run of a wake that has none", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValue(null)
        records.insertRun.mockResolvedValue(runRowOf())
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

    it("reads the run again when a racing open took the wake first, and refuses a race whose run it cannot read", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf())
        records.insertRun.mockResolvedValue(null)
        await expect(store.open(em, OPEN)).resolves.toMatchObject({ id: "run-1" })
        records.runOfWake.mockReset().mockResolvedValue(null)
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

describe("AgentRunStoreService reads", () => {
    it("reads the run of a wake (also through a transaction) and the run by id", async () => {
        const { store, records, em } = await build()
        records.runOfWake.mockResolvedValueOnce(runRecordOf()).mockResolvedValueOnce(null)
        records.run
            .mockResolvedValueOnce(runRecordOf())
            .mockResolvedValueOnce(null)
        await expect(store.runOfWake("ws-1", "wake-1")).resolves.toMatchObject({ wakeId: "wake-1" })
        await expect(store.runOfWake("ws-1", "wake-2", em)).resolves.toBeNull()
        await expect(store.runById("ws-1", "run-1")).resolves.toMatchObject({ id: "run-1" })
        await expect(store.runById("ws-1", "run-2")).resolves.toBeNull()
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

describe("AgentRunStoreService writes under the version read", () => {
    it("reads the run again when another writer moved it, and gives up with run_contended past its tries", async () => {
        const { store, records } = await build()
        records.run.mockResolvedValue(runRecordOf())
        records.stepsOf.mockResolvedValue([])
        records.patchRun.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf({ status: "cancelled" }))

        await expect(store.cancel("ws-1", "run-1", "member-1")).resolves.toEqual({ kind: "cancelled" })
        expect(records.patchRun).toHaveBeenCalledTimes(2)

        records.patchRun.mockReset().mockResolvedValue(null)
        await expect(store.cancel("ws-1", "run-1", "member-1")).rejects.toMatchObject({ code: "AGENT_RUNS_RUN_CONTENDED" })
    })
})
