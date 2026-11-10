import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { AgentRunDueService } from "./agent-run-due.service"
import { AgentRunRecordsService } from "./agent-run-records.service"
import { AgentRunStoreService } from "./agent-run-store.service"
import { WHEN, runRecordOf, stepRecordOf } from "@tests/fixtures/builders/agent-runs.builder"
import type { StepRecord } from "./agent-runs-records.contracts"

const scoped = mock<ScopedTx>({ workspaceId: "ws-1" })
const MINUTE = 60_000

const build = async () => {
    const store = mock<AgentRunStoreService>()
    store.at.mockImplementation((_ws, _manager, work) => work(scoped))
    const records = mock<AgentRunRecordsService>()
    records.stepsOfStatus.mockResolvedValue([])
    records.runsOf.mockResolvedValue([])
    records.run.mockResolvedValue(runRecordOf())
    records.stepsOf.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRunDueService,
            { provide: CLOCK, useValue: new FakeClock(WHEN) },
            { provide: AgentRunStoreService, useValue: store },
            { provide: AgentRunRecordsService, useValue: records },
        ],
    }).compile()
    return { service: moduleRef.get(AgentRunDueService), records }
}

type Records = ReturnType<typeof mock<AgentRunRecordsService>>

const byStatus = (records: Records, steps: Readonly<Record<string, ReadonlyArray<StepRecord>>>): void => {
    records.stepsOfStatus.mockImplementation((_scoped, status) => Promise.resolve(steps[status] ?? []))
}

describe("AgentRunDueService", () => {
    it("finds steps past their claim whose run is still running or waiting", async () => {
        const { service, records } = await build()
        byStatus(records, {
            running: [stepRecordOf({ status: "running", claimedUntil: new Date(WHEN.getTime() - 1) })],
        })

        const due = await service.due("ws-1", 5)

        expect(due).toEqual([
            {
                kind: "expired",
                runId: "run-1",
                workspaceId: "ws-1",
                agentId: "agent-1",
                stepKey: "step-1",
                fence: 2,
                at: new Date(WHEN.getTime() - 1),
            },
        ])
        expect(records.stepsOfStatus).toHaveBeenCalledWith(
            scoped,
            "running",
            { op: "lt", field: "claimedUntil", value: WHEN.toISOString() },
            expect.anything(),
            5,
        )
    })

    it("drops a due step whose run is gone or has ended", async () => {
        const { service, records } = await build()
        byStatus(records, { running: [stepRecordOf({ status: "running", claimedUntil: WHEN })] })
        records.run.mockResolvedValueOnce(null).mockResolvedValueOnce(runRecordOf({ status: "parked" }))

        await expect(service.due("ws-1", 5)).resolves.toEqual([])
        await expect(service.due("ws-1", 5)).resolves.toEqual([])
    })

    it("falls back to the clock for a step with no moment of its own", async () => {
        const { service, records } = await build()
        byStatus(records, { running: [stepRecordOf({ status: "running", claimedUntil: null })] })

        await expect(service.due("ws-1", 5)).resolves.toMatchObject([{ kind: "expired", at: WHEN }])
    })
})

describe("AgentRunDueService pending steps", () => {
    it("finds a pending step nobody picked up when nothing earlier in the run is open", async () => {
        const { service, records } = await build()
        const stale = new Date(WHEN.getTime() - 2 * MINUTE)
        byStatus(records, {
            pending: [stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending", notBefore: stale })],
        })
        records.stepsOf.mockResolvedValue([
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "done" }),
            stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending", notBefore: stale }),
        ])

        const due = await service.due("ws-1", 5)

        expect(due).toMatchObject([{ kind: "ready", stepKey: "b", at: stale }])
        expect(records.stepsOfStatus).toHaveBeenCalledWith(
            scoped,
            "pending",
            { op: "lt", field: "notBefore", value: new Date(WHEN.getTime() - MINUTE).toISOString() },
            expect.anything(),
            5,
        )
    })

    it("holds back a pending step while an earlier one is open or waiting for a try", async () => {
        const { service, records } = await build()
        byStatus(records, { pending: [stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending" })] })
        const later = stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending" })
        for (const earlier of [
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "pending" }),
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "failed" }),
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "running", waitItemId: null }),
        ]) {
            records.stepsOf.mockResolvedValue([earlier, later])
            await expect(service.due("ws-1", 5)).resolves.toEqual([])
        }
    })

    it("lets a pending step pass an earlier step that waits on a person or comes later", async () => {
        const { service, records } = await build()
        byStatus(records, { pending: [stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending", notBefore: null })] })
        records.stepsOf.mockResolvedValue([
            stepRecordOf({ stepKey: "a", ordinal: 1, status: "running", waitItemId: "item-1" }),
            stepRecordOf({ stepKey: "b", ordinal: 2, status: "pending" }),
            stepRecordOf({ stepKey: "c", ordinal: 3, status: "pending" }),
        ])

        await expect(service.due("ws-1", 5)).resolves.toMatchObject([{ kind: "ready", stepKey: "b" }])
    })
})

describe("AgentRunDueService undos and unspoken runs", () => {
    it("finds the undos to continue, with and without a lease, once the run is compensating", async () => {
        const { service, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "compensating" }))
        byStatus(records, {
            compensating: [
                stepRecordOf({ stepKey: "u", status: "compensating", claimedUntil: new Date(WHEN.getTime() - 5) }),
            ],
        })

        const due = await service.due("ws-1", 5)

        expect(due.map((item) => [item.kind, item.stepKey])).toEqual([
            ["compensating", "u"],
            ["compensating", "u"],
        ])
        expect(records.stepsOfStatus).toHaveBeenCalledWith(
            scoped,
            "compensating",
            {
                op: "and",
                of: [
                    { op: "isNull", field: "claimedUntil" },
                    { op: "lt", field: "updatedAt", value: new Date(WHEN.getTime() - MINUTE).toISOString() },
                ],
            },
            expect.anything(),
            5,
        )
    })

    it("falls back to the epoch for an undo with no lease", async () => {
        const { service, records } = await build()
        records.run.mockResolvedValue(runRecordOf({ status: "compensating" }))
        byStatus(records, { compensating: [stepRecordOf({ status: "compensating", claimedUntil: null })] })

        const due = await service.due("ws-1", 1)

        expect(due).toMatchObject([{ kind: "compensating", at: new Date(0) }])
    })

    it("finds the stopped runs nobody was told about, in every status that is told", async () => {
        const { service, records } = await build()
        records.runsOf.mockImplementation((_scoped, status) =>
            Promise.resolve(status === "parked" ? [runRecordOf({ id: "r-p", status: "parked" })] : []),
        )

        const due = await service.due("ws-1", 5)

        expect(due).toEqual([
            {
                kind: "unspoken",
                runId: "r-p",
                workspaceId: "ws-1",
                agentId: "agent-1",
                stepKey: "",
                fence: 0,
                at: WHEN,
            },
        ])
        expect(records.runsOf.mock.calls.map((call) => call[1])).toEqual(["parked", "dead", "compensated"])
    })
})

describe("AgentRunDueService: runs on a LangGraph thread are never due for the old sweep", () => {
    it("skips expired, ready and undo steps of a thread run, and its unspoken run", async () => {
        const { service, records } = await build()
        const old = WHEN.getTime() - 10 * MINUTE
        byStatus(records, {
            running: [stepRecordOf({ status: "running", claimedUntil: new Date(old) })],
            pending: [stepRecordOf({ status: "pending", notBefore: new Date(old) })],
        })
        records.run.mockResolvedValue(runRecordOf({ status: "running", engine: "langgraph" }))
        records.runsOf.mockResolvedValue([runRecordOf({ status: "failed", engine: "langgraph" })])

        await expect(service.due("ws-1", 10)).resolves.toEqual([])
    })
})
