import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import type { AgentRunStatus } from "./agent-runs.contracts"
import type { RunListFilter, StoredRun } from "./agent-runs-rows.contracts"
import { OPEN, WHEN, runRecordOf, runRowOf } from "@tests/fixtures/builders/agent-runs.builder"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })

/** 60 parked runs of one workflow, each for its own person; run 0 (the OLDEST) is the route `route-0`'s. */
const PARKED: ReadonlyArray<{ readonly id: string; readonly subjectId: string }> = Array.from({ length: 60 }, (_, at) => ({
    id: `run-${String(at)}`,
    subjectId: `route-${String(at)}`,
}))

/** The stored status and wait mark of a run; every run of the table is `waiting` with no wait mark unless a case says otherwise. */
interface RowState {
    readonly status: AgentRunStatus
    readonly waitMarked: boolean
}
const STOPPED: RowState = { status: "waiting", waitMarked: false }

/**
 * The table store as the subject index answers it: a filter on the subject finds exactly that subject's runs, whatever their age, in
 * the statuses asked, and only the wait-marked ones when the filter says so (`wait_match IS NOT NULL`).
 */
const tableOf = (states: ReadonlyMap<string, RowState>) => (filter: RunListFilter, limit: number): ReadonlyArray<StoredRun> => {
    const found = PARKED.filter((run) => {
        const state = states.get(run.id) ?? STOPPED
        return (
            (filter.subject === undefined || (filter.subject.kind === "routeId" && filter.subject.id === run.subjectId)) &&
            (filter.statuses === undefined || filter.statuses.includes(state.status)) &&
            (filter.waitMarked !== true || state.waitMarked)
        )
    })
    // Newest first, as the store orders `started`; a page of `limit`.
    return [...found].reverse().slice(0, limit).map((run) => runRowOf({ id: run.id, status: (states.get(run.id) ?? STOPPED).status }))
}

const build = async (states: ReadonlyMap<string, RowState> = new Map()) => {
    const engine = mock<EntityEngineService>()
    engine.scoped.mockImplementation((_ws, work) => work(scoped))
    engine.within.mockImplementation((_manager, _ws, work) => work(scoped))
    const records = mock<AgentRunRecordsService>()
    records.runRows.mockImplementation((_tx, filter, limit) => Promise.resolve(tableOf(states)(filter, limit)))
    records.run.mockImplementation((_tx, id) => Promise.resolve(runRecordOf({ id, status: (states.get(id) ?? STOPPED).status })))
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunStoreService,
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return { store: moduleRef.get(AgentRunStoreService), records }
}

describe("AgentRunStoreService: the run of a subject is found EXACTLY, however old (the final rule)", () => {
    it("with 60 parked runs of the workflow, the event of the OLDEST subject finds ITS run, not a page of the newest", async () => {
        const { store, records } = await build()

        await expect(store.inFlightOf("ws-1", "wf-sale", { kind: "routeId", id: "route-0" })).resolves.toMatchObject({ id: "run-0" })
        expect(records.runRows).toHaveBeenCalledWith(
            scoped,
            expect.objectContaining({ workflowId: "wf-sale", subject: { kind: "routeId", id: "route-0" }, statuses: ["running", "waiting", "parked"] }),
            1,
        )
        await expect(store.inFlightOf("ws-1", "wf-sale", { kind: "routeId", id: "route-none" })).resolves.toBeNull()
    })

    it("the parked runs of the oldest subject are found for its waits first, by the subject, not by a page of the agent's runs", async () => {
        const { store } = await build()

        const parked = await store.parkedOfSubject("ws-1", "agent-1", { kind: "routeId", id: "route-0" })

        expect(parked.map((run) => run.id)).toEqual(["run-0"])
    })

    it("writes the subject on the run it opens, so the partial unique index holds one run in flight per (workflow, subject)", async () => {
        const { store, records } = await build()
        records.runOfWake.mockResolvedValue(null)
        records.insertRun.mockResolvedValue(runRowOf())

        await store.open(mockEntityManager(), { ...OPEN, subject: { kind: "routeId", id: "route-7" } })

        expect(records.insertRun).toHaveBeenCalledWith(scoped, expect.objectContaining({ subjectKind: "routeId", subjectId: "route-7" }))
    })
})

describe("AgentRunStoreService.endParkedOfSubjects (coordinator ruling R37: the runs of an erased subject end)", () => {
    it("ends every run parked on the subjects with the typed reason, clears its wait mark and deadline, and leaves other subjects", async () => {
        const { store, records } = await build()
        records.patchRun.mockImplementation((_tx, run) => Promise.resolve({ ...run, status: "cancelled" }))
        const tx = mockEntityManager()

        const subjects = [
            { kind: "routeId", id: "route-3" },
            { kind: "contactId", id: "c-9" },
        ]
        const ended = await store.endParkedOfSubjects(tx, "ws-1", subjects, "subject_erased")

        expect(ended.map((run) => run.id)).toEqual(["run-3"])
        expect(records.runRows).toHaveBeenCalledWith(
            scoped,
            expect.objectContaining({ subject: { kind: "routeId", id: "route-3" }, statuses: ["waiting", "parked"], engine: "langgraph" }),
            expect.any(Number),
        )
        expect(records.patchRun).toHaveBeenCalledTimes(1)
        expect(records.patchRun).toHaveBeenCalledWith(
            scoped,
            expect.objectContaining({ id: "run-3" }),
            expect.objectContaining({ status: "cancelled", error: { code: "subject_erased" }, waitWorkItemId: null, waitDeadlineAt: null }),
        )
        expect(records.markWait).toHaveBeenCalledWith(scoped, "run-3", null)
        // Its open step rows close with it, same scope, same reason (E-FIX4: they stayed `running` and blocked `tools reseed`).
        expect(records.closeOpenSteps).toHaveBeenCalledTimes(1)
        expect(records.closeOpenSteps).toHaveBeenCalledWith(scoped, "run-3", "subject_erased", WHEN.toISOString())
    })

    it("ends a run parked at a `wait` (status `running` WITH a wait mark), the sale parked for the erased person (S5c finding)", async () => {
        const { store, records } = await build(new Map([["run-3", { status: "running", waitMarked: true }]]))
        records.patchRun.mockImplementation((_tx, run) => Promise.resolve({ ...run, status: "cancelled" }))

        const ended = await store.endParkedOfSubjects(mockEntityManager(), "ws-1", [{ kind: "routeId", id: "route-3" }], "subject_erased")

        expect(ended.map((run) => run.id)).toEqual(["run-3"])
        expect(records.runRows).toHaveBeenCalledWith(
            scoped,
            expect.objectContaining({ subject: { kind: "routeId", id: "route-3" }, statuses: ["running"], waitMarked: true }),
            expect.any(Number),
        )
        expect(records.patchRun).toHaveBeenCalledTimes(1)
        expect(records.markWait).toHaveBeenCalledWith(scoped, "run-3", null)
        // The dev shape: `talk` and `talk[r2].hear` were left `running`; the closing function closes them with the reason.
        expect(records.closeOpenSteps).toHaveBeenCalledWith(scoped, "run-3", "subject_erased", WHEN.toISOString())
    })

    it("leaves a run running a step now (status `running`, no wait mark): it ends on its own", async () => {
        const { store, records } = await build(new Map([["run-3", { status: "running", waitMarked: false }]]))

        await expect(
            store.endParkedOfSubjects(mockEntityManager(), "ws-1", [{ kind: "routeId", id: "route-3" }], "subject_erased"),
        ).resolves.toEqual([])
        expect(records.patchRun).not.toHaveBeenCalled()
        expect(records.closeOpenSteps).not.toHaveBeenCalled()
    })

    it("ends nothing for a run that moved on before the write (no longer parked)", async () => {
        const { store, records } = await build()
        records.run.mockImplementation((_tx, id) => Promise.resolve(runRecordOf({ id, status: "running" })))

        const ending = store.endParkedOfSubjects(mockEntityManager(), "ws-1", [{ kind: "routeId", id: "route-3" }], "subject_erased")
        await expect(ending).resolves.toEqual([])
        expect(records.patchRun).not.toHaveBeenCalled()
        expect(records.markWait).not.toHaveBeenCalled()
        expect(records.closeOpenSteps).not.toHaveBeenCalled()
    })
})
