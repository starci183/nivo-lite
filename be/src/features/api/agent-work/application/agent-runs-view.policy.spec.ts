import type { RunDetail, RunListEntry, RunStepDetail } from "@modules/domain/agent-runs"
import type { WorkItem } from "@modules/domain/work-items"
import { boardOf, boardStatusOf, detailOf, factsOf, recoveredFactsOf, sourceOf, stepStatusOf } from "./agent-runs-view.policy"

const NOW = new Date("2026-11-09T08:00:00.000Z")

const runOf = (overrides: Record<string, unknown> = {}): RunListEntry["run"] =>
    ({
        id: "run-1",
        workspaceId: "ws-1",
        version: "1",
        agentId: "agent-1",
        wakeId: "wake-1",
        trigger: "tag",
        graphVersionId: "v-3",
        planning: false,
        status: "running",
        context: { conversationId: "c-1" },
        errorCode: null,
        deadLetteredAt: null,
        parkedBuild: null,
        resumeAttempts: 0,
        resumeNotBefore: null,
        endedAt: null,
        startedAt: new Date("2026-11-09T07:59:00.000Z"),
        stepSeq: 3,
        cancelledAt: null,
        cancelledBy: null,
        ...overrides,
    }) as RunListEntry["run"]

const entryOf = (overrides: Partial<RunListEntry> = {}, run: Record<string, unknown> = {}): RunListEntry => ({
    run: runOf(run),
    stepTotal: 4,
    stepDone: 2,
    stepBegun: 3,
    stepFailed: 0,
    workItemId: null,
    ...overrides,
})

const stepOf = (overrides: Partial<RunStepDetail> = {}): RunStepDetail => ({
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
    ...overrides,
})

const itemOf = (): WorkItem =>
    ({
        id: "w-1",
        action: "record_payment",
        status: "waiting_decision",
        reason: "unclear",
        proposal: { summary: "Match 1000 to order 1042", fields: {}, evidence: [{ key: "content", value: "CHUYEN TIEN" }] },
        result: null,
        error: null,
    }) as unknown as WorkItem

describe("boardStatusOf", () => {
    it("tells a run that has begun a step as running and one that has not as queued", () => {
        expect(boardStatusOf(entryOf())).toBe("running")
        expect(boardStatusOf(entryOf({ stepBegun: 0 }))).toBe("queued")
    })

    it("tells a run the clock woke, before its first step, as scheduled", () => {
        expect(boardStatusOf(entryOf({ stepBegun: 0 }, { context: { slot: "1789000000000" } }))).toBe("scheduled")
    })

    it("tells a stopped, parked or given-away run as failed and a waiting or finished one as itself", () => {
        expect(boardStatusOf(entryOf({}, { status: "failed" }))).toBe("failed")
        expect(boardStatusOf(entryOf({}, { status: "compensating" }))).toBe("failed")
        expect(boardStatusOf(entryOf({}, { status: "parked" }))).toBe("failed")
        expect(boardStatusOf(entryOf({}, { status: "dead" }))).toBe("failed")
        expect(boardStatusOf(entryOf({}, { status: "waiting" }))).toBe("waiting")
        expect(boardStatusOf(entryOf({}, { status: "done" }))).toBe("done")
    })
})

describe("sourceOf", () => {
    it("names what woke the run by the ids its context carries", () => {
        expect(sourceOf({ slot: "1" })).toBe("schedule")
        expect(sourceOf({ authorAgentId: "a" })).toBe("agent")
        expect(sourceOf({ authorUserId: "u" })).toBe("person")
        expect(sourceOf({ conversationId: "c" })).toBe("customer")
        expect(sourceOf({ eventName: "paid" })).toBe("event")
    })
})

describe("boardOf", () => {
    it("counts what runs and what queues, places queued runs oldest first and groups the runs by graph version", () => {
        const entries = [
            entryOf({ stepBegun: 0 }, { id: "q-new", startedAt: new Date("2026-11-09T07:59:30.000Z") }),
            entryOf({ stepBegun: 0 }, { id: "q-old", startedAt: new Date("2026-11-09T07:58:00.000Z") }),
            entryOf({}, { id: "r-1", graphVersionId: "v-2" }),
            entryOf({}, { id: "d-1", status: "done", endedAt: new Date("2026-11-09T07:59:30.000Z") }),
        ]
        const board = boardOf(entries, new Map([["v-3", 3], ["v-2", 2]]), new Map(), NOW)
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

    it("names a run by its work item and counts its time to now while it runs", () => {
        const board = boardOf([entryOf({ workItemId: "w-1" })], new Map([["v-3", 3]]), new Map([["w-1", itemOf()]]), NOW)
        expect(board.runs[0]).toMatchObject({ title: "Match 1000 to order 1042", durationMs: 60_000, stepNumber: 3 })
    })

    it("tells the limit of the app and the runs using a place now, apart from the runs that wait on a person", () => {
        const entries = [
            entryOf({}, { id: "r-1" }),
            entryOf({}, { id: "r-2" }),
            entryOf({}, { id: "w-1", status: "waiting" }),
        ]
        const board = boardOf(entries, new Map(), new Map(), NOW, { concurrencyLimit: 6 })
        expect(board).toMatchObject({ concurrencyLimit: 6, activeCount: 2, runningCount: 3 })
        expect(boardOf(entries, new Map(), new Map(), NOW).concurrencyLimit).toBe(4)
    })

    it("gives each run the credits its model calls used, and a cancelled run its moment", () => {
        const cancelledAt = new Date("2026-11-09T07:59:40.000Z")
        const board = boardOf(
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

    it("lists a run with no graph under the workflow none", () => {
        const board = boardOf([entryOf({}, { graphVersionId: null })], new Map(), new Map(), NOW)
        expect(board.workflows).toEqual([{ key: "none", versionNumber: null, count: 1 }])
    })
})

describe("recoveredFactsOf", () => {
    it("tells the kind and the code of a step the AI core took over", () => {
        expect(recoveredFactsOf({ reply: "ok", recovered: { by: "ai", code: "handler_threw", kind: "threw" } })).toEqual([
            { key: "recovered", value: "threw" },
            { key: "recoveredCode", value: "handler_threw" },
        ])
    })

    it("tells nothing of a step that ran as written, and reads an unknown kind as a failure", () => {
        expect(recoveredFactsOf({ reply: "ok" })).toEqual([])
        expect(recoveredFactsOf(null)).toEqual([])
        expect(recoveredFactsOf({ recovered: { by: "person", code: "x", kind: "threw" } })).toEqual([])
        expect(recoveredFactsOf({ recovered: { by: "ai", kind: "other" } })).toEqual([
            { key: "recovered", value: "failed" },
            { key: "recoveredCode", value: "" },
        ])
    })
})

describe("factsOf", () => {
    it("tells the plain fields only, cut to a length, and leaves the engine's own keys out", () => {
        const long = "x".repeat(300)
        const facts = factsOf({ amount: 1000, note: long, nested: { a: 1 }, versionId: "v", ok: true })
        expect(facts.map((fact) => fact.key)).toEqual(["amount", "note", "ok"])
        expect(facts[1]?.value).toHaveLength(160)
    })

    it("tells nothing of a value that is no object", () => {
        expect(factsOf(null)).toEqual([])
        expect(factsOf([1])).toEqual([])
    })
})

describe("stepStatusOf", () => {
    it("tells a running step that holds a wait as waiting and an undone step as undone", () => {
        expect(stepStatusOf(stepOf({ status: "running", waitItemId: "w-1" }))).toBe("waiting")
        expect(stepStatusOf(stepOf({ status: "running" }))).toBe("running")
        expect(stepStatusOf(stepOf({ status: "compensated" }))).toBe("undone")
    })
})

describe("detailOf", () => {
    const detail = (status: string, steps: ReadonlyArray<RunStepDetail>): RunDetail => ({
        run: runOf({ status, errorCode: "tool_denied" }),
        steps,
    })

    it("never offers Resume; tells a failed run's row from its steps", () => {
        const failed = detailOf(
            {
                ...detail("failed", [stepOf(), stepOf({ stepKey: "write", status: "failed", errorCode: "tool_denied" })]),
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

    it("never offers the old Resume on a thread run; its Cancel (the stop's skip) only while it waits at a stop", () => {
        const failed = [stepOf({ stepKey: "match", status: "failed", errorCode: "ai_report" })]
        const thread = (status: string): RunDetail => ({ ...detail(status, failed), engine: "langgraph" })
        const credits = new Map([["run-1", 7]])
        const waiting = detailOf(thread("waiting"), new Map(), null, NOW, credits)
        expect(waiting.canResume).toBe(false)
        expect(waiting.canCancel).toBe(true)
        expect(waiting.row.creditsUsed).toBe(7)
        for (const status of ["running", "failed", "dead", "parked", "done", "cancelled"]) {
            const other = detailOf(thread(status), new Map(), null, NOW)
            expect(other.canResume).toBe(false)
            expect(other.canCancel).toBe(false)
        }
    })

    it("offers nothing on a run of the old engine, whatever its status: it is history", () => {
        const step = stepOf({ status: "failed" })
        for (const status of ["running", "waiting", "parked", "failed", "dead"]) {
            const legacy = detailOf({ ...detail(status, [step]), engine: "legacy" }, new Map(), null, NOW)
            expect(legacy.canResume).toBe(false)
            expect(legacy.canCancel).toBe(false)
        }
        const unnamed = detailOf(detail("waiting", [step]), new Map(), null, NOW)
        expect(unnamed.canCancel).toBe(false)
    })

    it("carries the work item a run is about, with its evidence", () => {
        const undone = detailOf(
            detail("failed", [stepOf({ status: "compensated" }), stepOf({ stepKey: "b", status: "failed" })]),
            new Map(),
            itemOf(),
            NOW,
        )
        expect(undone.canResume).toBe(false)
        expect(undone.item).toMatchObject({ id: "w-1", status: "waiting_decision", reason: "unclear" })
        expect(undone.item?.evidence).toEqual([{ key: "content", value: "CHUYEN TIEN" }])
    })
})
