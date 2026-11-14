import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { RunDetail, RunListEntry, RunRecord, RunStepDetail } from "@modules/domain/agent-runs"
import type { WorkItem } from "@modules/domain/work-items"
import { runRecordOf } from "@tests/fixtures/builders/agent-runs.builder"
import { boardOf, boardStatusOf, detailOf, factsOf, recoveredFactsOf, sourceOf, stepStatusOf } from "./agent-runs-view.policy"

const SUBJECT = Symbol("agent-runs-view.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { boardOf, boardStatusOf, detailOf, factsOf, recoveredFactsOf, sourceOf, stepStatusOf },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./agent-runs-view.policy")>(SUBJECT)
}

const NOW = new Date("2026-11-09T08:00:00.000Z")

type RunStatus = RunRecord["status"]

const runOf = (overrides: Partial<RunRecord> = {}): RunRecord =>
    runRecordOf({
        version: "1",
        trigger: "tag",
        graphVersionId: "v-3",
        startedAt: new Date("2026-11-09T07:59:00.000Z"),
        stepSeq: 3,
        ...overrides,
    })

const entryOf = (overrides: Partial<RunListEntry> = {}, run: Partial<RunRecord> = {}): RunListEntry => ({
    run: runOf(run),
    stepTotal: 4,
    stepDone: 2,
    stepBegun: 3,
    stepFailed: 0,
    workItemId: null,
    ...overrides,
})

const stepOf: (overrides?: Partial<RunStepDetail>) => RunStepDetail = builder<RunStepDetail>({
    stepKey: "evidence",
    nodeKey: "evidence",
    kind: "graph_node",
    ordinal: 1,
    status: "done",
    attempt: 1,
    maxAttempts: 3,
    startedAt: new Date("2026-11-09T07:59:01.000Z"),
    endedAt: new Date("2026-11-09T07:59:03.000Z"),
    durationMs: 2000,
    errorCode: null,
    waitItemId: null,
    workItemId: null,
    input: {},
    result: null,
    calls: [],
})

const itemOf: () => WorkItem = builder<WorkItem>({
    id: "w-1",
    workspace_id: "ws-1",
    department: "finance",
    action: "record_payment",
    subject_type: "transaction",
    subject_id: null,
    lead_id: null,
    inbound_event_id: null,
    parent_id: null,
    chain_id: null,
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "unclear_outcome",
    reasons: [],
    missing_fields: [],
    proposal: {
        summary: "Match 1000 to order 1042",
        fields: {},
        evidence: [{ key: "content", value: "CHUYEN TIEN", kind: "read", via: "bank_feed" }],
    },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-11-09T07:58:00.000Z",
    updated_at: "2026-11-09T07:58:00.000Z",
    completed_at: null,
    installation_id: null,
})

describe("boardStatusOf", () => {
    it("tells a run that has begun a step as running and one that has not as queued", async () => {
        const subject = await build()
        expect(subject.boardStatusOf(entryOf())).toBe("running")
        expect(subject.boardStatusOf(entryOf({ stepBegun: 0 }))).toBe("queued")
    })

    it("tells a run the clock woke, before its first step, as scheduled", async () => {
        const subject = await build()
        expect(subject.boardStatusOf(entryOf({ stepBegun: 0 }, { context: { slot: "1789000000000" } }))).toBe("scheduled")
    })

    it("tells a stopped, parked or given-away run as failed and a waiting or finished one as itself", async () => {
        const subject = await build()
        expect(subject.boardStatusOf(entryOf({}, { status: "failed" }))).toBe("failed")
        expect(subject.boardStatusOf(entryOf({}, { status: "compensating" }))).toBe("failed")
        expect(subject.boardStatusOf(entryOf({}, { status: "parked" }))).toBe("failed")
        expect(subject.boardStatusOf(entryOf({}, { status: "dead" }))).toBe("failed")
        expect(subject.boardStatusOf(entryOf({}, { status: "waiting" }))).toBe("waiting")
        expect(subject.boardStatusOf(entryOf({}, { status: "done" }))).toBe("done")
    })
})

describe("sourceOf", () => {
    it("names what woke the run by the ids its context carries", async () => {
        const subject = await build()
        expect(subject.sourceOf({ slot: "1" })).toBe("schedule")
        expect(subject.sourceOf({ authorAgentId: "a" })).toBe("agent")
        expect(subject.sourceOf({ authorUserId: "u" })).toBe("person")
        expect(subject.sourceOf({ conversationId: "c" })).toBe("customer")
        expect(subject.sourceOf({ eventName: "paid" })).toBe("event")
    })
})

describe("boardOf", () => {
    it("counts what runs and what queues, places queued runs oldest first and groups the runs by graph version", async () => {
        const subject = await build()
        const entries = [
            entryOf({ stepBegun: 0 }, { id: "q-new", startedAt: new Date("2026-11-09T07:59:30.000Z") }),
            entryOf({ stepBegun: 0 }, { id: "q-old", startedAt: new Date("2026-11-09T07:58:00.000Z") }),
            entryOf({}, { id: "r-1", graphVersionId: "v-2" }),
            entryOf({}, { id: "d-1", status: "done", endedAt: new Date("2026-11-09T07:59:30.000Z") }),
        ]
        const board = subject.boardOf(entries, new Map([["v-3", 3], ["v-2", 2]]), new Map(), NOW)
        expect(board.runningCount).toBe(1)
        expect(board.queuedCount).toBe(2)
        expect(board.runs.find((row) => row.id === "q-old")?.queuePosition).toBe(1)
        expect(board.runs.find((row) => row.id === "q-new")?.queuePosition).toBe(2)
        expect(board.runs.find((row) => row.id === "r-1")?.queuePosition).toBeNull()
        expect(board.workflows).toEqual([
            { key: "v-3", versionNumber: 3, count: 3 },
            { key: "v-2", versionNumber: 2, count: 1 },
        ])
    })

    it("names a run by its work item and counts its time to now while it runs", async () => {
        const subject = await build()
        const board = subject.boardOf(
            [entryOf({ workItemId: "w-1" })],
            new Map([["v-3", 3]]),
            new Map([["w-1", itemOf()]]),
            NOW,
        )
        expect(board.runs[0]).toMatchObject({ title: "Match 1000 to order 1042", durationMs: 60_000, stepNumber: 3 })
    })

    it("tells the limit of the app and the runs using a place now, apart from the runs that wait on a person", async () => {
        const subject = await build()
        const entries = [
            entryOf({}, { id: "r-1" }),
            entryOf({}, { id: "r-2" }),
            entryOf({}, { id: "w-1", status: "waiting" }),
        ]
        const board = subject.boardOf(entries, new Map(), new Map(), NOW, { concurrencyLimit: 6 })
        expect(board).toMatchObject({ concurrencyLimit: 6, activeCount: 2, runningCount: 3 })
        expect(subject.boardOf(entries, new Map(), new Map(), NOW).concurrencyLimit).toBe(100)
    })

    it("gives each run the credits its model calls used, and a cancelled run its moment", async () => {
        const subject = await build()
        const cancelledAt = new Date("2026-11-09T07:59:40.000Z")
        const board = subject.boardOf(
            [entryOf({}, { id: "r-1" }), entryOf({}, { id: "c-1", status: "cancelled", cancelledAt, endedAt: cancelledAt })],
            new Map(),
            new Map(),
            NOW,
            { credits: new Map([["r-1", 12]]) },
        )
        expect(board.runs.find((row) => row.id === "r-1")).toMatchObject({ creditsUsed: 12, cancelledAt: null })
        expect(board.runs.find((row) => row.id === "c-1")).toMatchObject({
            status: "cancelled",
            creditsUsed: 0,
            cancelledAt: cancelledAt.toISOString(),
        })
        expect(board.runningCount).toBe(1)
    })

    it("lists a run with no graph under the workflow none", async () => {
        const subject = await build()
        const board = subject.boardOf([entryOf({}, { graphVersionId: null })], new Map(), new Map(), NOW)
        expect(board.workflows).toEqual([{ key: "none", versionNumber: null, count: 1 }])
    })
})

describe("recoveredFactsOf", () => {
    it("tells the kind and the code of a step the AI core took over", async () => {
        const subject = await build()
        expect(subject.recoveredFactsOf({ reply: "ok", recovered: { by: "ai", code: "handler_threw", kind: "threw" } })).toEqual([
            { key: "recovered", value: "threw" },
            { key: "recoveredCode", value: "handler_threw" },
        ])
    })

    it("tells nothing of a step that ran as written, and reads an unknown kind as a failure", async () => {
        const subject = await build()
        expect(subject.recoveredFactsOf({ reply: "ok" })).toEqual([])
        expect(subject.recoveredFactsOf(null)).toEqual([])
        expect(subject.recoveredFactsOf({ recovered: { by: "person", code: "x", kind: "threw" } })).toEqual([])
        expect(subject.recoveredFactsOf({ recovered: { by: "ai", kind: "other" } })).toEqual([
            { key: "recovered", value: "failed" },
            { key: "recoveredCode", value: "" },
        ])
    })
})

describe("factsOf", () => {
    it("tells the plain fields only, cut to a length, and leaves the engine's own keys out", async () => {
        const subject = await build()
        const long = "x".repeat(300)
        const facts = subject.factsOf({ amount: 1000, note: long, nested: { a: 1 }, versionId: "v", ok: true })
        expect(facts.map((fact) => fact.key)).toEqual(["amount", "note", "ok"])
        expect(facts[1]?.value).toHaveLength(160)
    })

    it("tells nothing of a value that is no object", async () => {
        const subject = await build()
        expect(subject.factsOf(null)).toEqual([])
        expect(subject.factsOf([1])).toEqual([])
    })
})

describe("stepStatusOf", () => {
    it("tells a running step that holds a wait as waiting and an undone step as undone", async () => {
        const subject = await build()
        expect(subject.stepStatusOf(stepOf({ status: "running", waitItemId: "w-1" }))).toBe("waiting")
        expect(subject.stepStatusOf(stepOf({ status: "running" }))).toBe("running")
        expect(subject.stepStatusOf(stepOf({ status: "compensated" }))).toBe("undone")
    })
})

const detailWith = (status: RunStatus, steps: ReadonlyArray<RunStepDetail>): RunDetail => ({
    run: runOf({ status, errorCode: "tool_denied" }),
    steps,
})

describe("detailOf", () => {
    describe("on a thread run", () => {
        it("never offers Resume; tells a failed run's row from its steps", async () => {
            const subject = await build()
            const failed = subject.detailOf(
                {
                    ...detailWith("failed", [stepOf(), stepOf({ stepKey: "write", status: "failed", errorCode: "tool_denied" })]),
                    engine: "langgraph",
                },
                new Map([["v-3", 3]]),
                null,
                NOW,
            )
            expect(failed.canResume).toBe(false)
            expect(failed.row.status).toBe("failed")
            expect(failed.row.stepNumber).toBe(2)
        })

        it("never offers the old Resume on a thread run; its Cancel (the stop's skip) only while it waits at a stop", async () => {
            const subject = await build()
            const failed = [stepOf({ stepKey: "match", status: "failed", errorCode: "ai_report" })]
            const thread = (status: RunStatus): RunDetail => ({ ...detailWith(status, failed), engine: "langgraph" })
            const credits = new Map([["run-1", 7]])
            const waiting = subject.detailOf(thread("waiting"), new Map(), null, NOW, credits)
            expect(waiting.canResume).toBe(false)
            expect(waiting.canCancel).toBe(true)
            expect(waiting.row.creditsUsed).toBe(7)
            const others: ReadonlyArray<RunStatus> = ["running", "failed", "dead", "parked", "done", "cancelled"]
            for (const status of others) {
                const other = subject.detailOf(thread(status), new Map(), null, NOW)
                expect(other.canResume).toBe(false)
                expect(other.canCancel).toBe(false)
            }
        })
    })

    describe("on a run of the old engine", () => {
        it("offers nothing on a run of the old engine, whatever its status: it is history", async () => {
            const subject = await build()
            const step = stepOf({ status: "failed" })
            const statuses: ReadonlyArray<RunStatus> = ["running", "waiting", "parked", "failed", "dead"]
            for (const status of statuses) {
                const legacy = subject.detailOf({ ...detailWith(status, [step]), engine: "legacy" }, new Map(), null, NOW)
                expect(legacy.canResume).toBe(false)
                expect(legacy.canCancel).toBe(false)
            }
            const unnamed = subject.detailOf(detailWith("waiting", [step]), new Map(), null, NOW)
            expect(unnamed.canCancel).toBe(false)
        })
    })

    describe("on a run about a work item", () => {
        it("carries the work item a run is about, with its evidence", async () => {
            const subject = await build()
            const undone = subject.detailOf(
                detailWith("failed", [stepOf({ status: "compensated" }), stepOf({ stepKey: "b", status: "failed" })]),
                new Map(),
                itemOf(),
                NOW,
            )
            expect(undone.canResume).toBe(false)
            expect(undone.item).toMatchObject({ id: "w-1", status: "waiting_decision", reason: "unclear_outcome" })
            expect(undone.item?.evidence).toEqual([{ key: "content", value: "CHUYEN TIEN" }])
        })
    })
})
