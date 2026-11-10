import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import {
    callsOf,
    clockOf,
    countsOf,
    durationOf,
    filterOf,
    runRowOf,
    runStateOf,
    runViewOf,
    statusesOf,
    summaryOf,
    whenOf,
} from "./agent-runs"
import type { RunLocale } from "./agent-runs"

const NOW = new Date("2026-11-05T08:10:00.000Z")
const WHERE: RunLocale = { locale: "en", timeZone: "UTC", now: NOW }

const record = (id: string, data: Record<string, unknown>): RecordRow => ({
    id,
    workspaceId: "w1",
    version: "1",
    createdAt: "2026-11-05T08:00:00.000Z",
    updatedAt: "2026-11-05T08:00:00.000Z",
    data,
})

describe("the filters of the runs list", () => {
    it("stand each for the engine statuses a person tells as one", () => {
        expect(statusesOf("running")).toEqual(["running", "waiting", "compensating"])
        expect(statusesOf("parked")).toEqual(["parked"])
        expect(statusesOf("done")).toEqual(["done", "compensated"])
        expect(statusesOf("failed")).toEqual(["failed", "dead"])
    })

    it("name the filter of a status, and list a status they do not know as running", () => {
        expect(filterOf("compensated")).toBe("done")
        expect(filterOf("dead")).toBe("failed")
        expect(filterOf("parked")).toBe("parked")
        expect(filterOf("something-new")).toBe("running")
        expect(filterOf(undefined)).toBe("running")
    })

    it("draw a run in the state of its status on the timeline", () => {
        expect(runStateOf("waiting")).toBe("waiting")
        expect(runStateOf("parked")).toBe("parked")
        expect(runStateOf("dead")).toBe("failed")
        expect(runStateOf("failed")).toBe("failed")
        expect(runStateOf("compensated")).toBe("done")
        expect(runStateOf("done")).toBe("done")
        expect(runStateOf("compensating")).toBe("running")
        expect(runStateOf("running")).toBe("running")
    })
})

describe("the times of a run", () => {
    it("draw a length as a clock, with hours only when there are some", () => {
        expect(clockOf(0)).toBe("0:00")
        expect(clockOf(42_000)).toBe("0:42")
        expect(clockOf(185_000)).toBe("3:05")
        expect(clockOf(3_723_000)).toBe("1:02:03")
        expect(clockOf(-5000)).toBe("0:00")
    })

    it("draw the start in the language and the zone of the viewer, and nothing for a value that is no date", () => {
        expect(whenOf("2026-11-05T08:00:00.000Z", WHERE)).toBe("11/5/26, 8:00 AM")
        expect(whenOf("2026-11-05T08:00:00.000Z", { ...WHERE, locale: "vi", timeZone: "Asia/Ho_Chi_Minh" })).toContain(
            "15:00",
        )
        expect(whenOf("not a date", WHERE)).toBe("")
        expect(whenOf(null, WHERE)).toBe("")
    })

    it("take the length from the start to the end, or to now while the run has not ended, and none without a start", () => {
        expect(durationOf("2026-11-05T08:00:00.000Z", "2026-11-05T08:01:07.000Z", NOW)).toBe("1:07")
        expect(durationOf("2026-11-05T08:00:00.000Z", null, NOW)).toBe("10:00")
        expect(durationOf(undefined, null, NOW)).toBe("")
    })
})

describe("a row of the runs list", () => {
    it("carries the id the resume takes, the filter, the trigger, the start and the length", () => {
        const row = runRowOf(
            record("run-1", {
                trigger: "zalo.message",
                status: "waiting",
                startedAt: "2026-11-05T08:00:00.000Z",
                endedAt: null,
            }),
            WHERE,
        )
        expect(row).toEqual({
            id: "run-1",
            status: "running",
            trigger: "zalo.message",
            when: "11/5/26, 8:00 AM",
            duration: "10:00",
        })
    })

    it("has an empty trigger when the engine kept none", () => {
        expect(runRowOf(record("run-2", { status: "dead" }), WHERE)).toMatchObject({
            status: "failed",
            trigger: "",
            when: "",
            duration: "",
        })
    })
})

describe("the counts of the filter tabs", () => {
    it("add the statuses of one filter up, name every filter and sum them", () => {
        expect(
            countsOf([
                { groups: { status: "running" }, measures: { count: 2 } },
                { groups: { status: "waiting" }, measures: { count: 1 } },
                { groups: { status: "done" }, measures: { count: 5 } },
                { groups: { status: "dead" }, measures: { count: 1 } },
            ]),
        ).toEqual({ counts: { running: 3, parked: 0, done: 5, failed: 1 }, total: 9 })
    })

    it("skip a group that holds no number, and count nothing for no group", () => {
        expect(countsOf([{ groups: { status: "done" }, measures: { count: "many" } }]).total).toBe(0)
        expect(countsOf([])).toEqual({ counts: { running: 0, parked: 0, done: 0, failed: 0 }, total: 0 })
    })
})

describe("the lines of a step", () => {
    it("tell the plain fields of what the step held, cut at a length, and nothing for what is no object", () => {
        expect(summaryOf({ order: "A-1", total: 4800000, paid: false, nested: { a: 1 }, none: null })).toBe(
            "order: A-1, total: 4800000, paid: false",
        )
        expect(summaryOf({ text: "x".repeat(400) })).toHaveLength(160)
        expect(summaryOf({ text: "x".repeat(400) }).endsWith("…")).toBe(true)
        expect(summaryOf(null)).toBe("")
        expect(summaryOf(["a"])).toBe("")
        expect(summaryOf("text")).toBe("")
    })

    it("list the door calls with the failure of a refused one, and skip what is not a call", () => {
        expect(
            callsOf({
                calls: [
                    { tool: "nivo.chat.send", ok: false, failure: "refused", effectKey: "k" },
                    { tool: "catalogue.search", ok: true, effectKey: "k2" },
                    { tool: "no-ok" },
                    { ok: true },
                    "text",
                    null,
                ],
            }),
        ).toEqual([
            { tool: "nivo.chat.send", ok: false, summary: "refused" },
            { tool: "catalogue.search", ok: true, summary: null },
        ])
        expect(callsOf({ calls: "none" })).toEqual([])
        expect(callsOf({})).toEqual([])
        expect(callsOf(null)).toEqual([])
    })
})

const STEPS: ReadonlyArray<RecordRow> = [
    record("s1", {
        stepKey: "inbound",
        nodeKey: "inbound",
        status: "done",
        input: { text: "hi" },
        result: { ok: true },
        startedAt: "2026-11-05T08:00:00.000Z",
        durationMs: 120,
        doorCalls: { calls: [{ tool: "chat.read", ok: true, effectKey: "k" }] },
        effectKey: "chat.read:1",
    }),
    record("s2", {
        stepKey: "send",
        nodeKey: "send-quote",
        status: "failed",
        errorCode: "DELIVERY_FAILED",
        waitItemId: null,
    }),
    record("s3", { stepKey: "after", nodeKey: "after", status: "pending", waitItemId: "w-1" }),
]

describe("the timeline of a run", () => {
    it("tells the step a parked run stopped at as parked, with the reason the engine parked it, and the others as they went", () => {
        const view = runViewOf(record("run-3", { status: "parked", parkReason: "The send was refused" }), STEPS)
        expect(view.id).toBe("run-3")
        expect(view.status).toBe("parked")
        expect(view.steps.map((step) => step.state)).toEqual(["done", "parked", "running"])
        expect(view.steps[0]).toMatchObject({
            id: "inbound",
            node: "inbound",
            label: "inbound",
            at: "2026-11-05T08:00:00.000Z",
            inputSummary: "text: hi",
            outputSummary: "ok: true",
            durationMs: 120,
            effectKey: "chat.read:1",
            reason: null,
            approvalPath: null,
            calls: [{ tool: "chat.read", ok: true, summary: null }],
        })
        expect(view.steps[1]).toMatchObject({ label: "send-quote", reason: "The send was refused", at: null })
    })

    it("keeps the error code of a parked step when the engine left no reason", () => {
        const view = runViewOf(record("run-3", { status: "parked" }), STEPS)
        expect(view.steps[1]?.reason).toBe("DELIVERY_FAILED")
    })

    it("tells a failed step failed, and a step that waits on an item of a waiting run waiting", () => {
        const failed = runViewOf(record("run-4", { status: "failed" }), STEPS)
        expect(failed.status).toBe("failed")
        expect(failed.steps.map((step) => step.state)).toEqual(["done", "failed", "running"])
        const waiting = runViewOf(record("run-5", { status: "waiting" }), STEPS)
        expect(waiting.steps.map((step) => step.state)).toEqual(["done", "failed", "waiting"])
    })

    it.each(["failed", "dead"])("offers to run a %s run again from its first failed step only", (status) => {
        const view = runViewOf(record("run-7", { status }), STEPS)
        expect(view.steps.map((step) => step.canResume)).toEqual([undefined, true, undefined])
        expect(view.steps[1]?.state).toBe("failed")
    })

    it("offers nothing on a failed run when one of its steps was undone, or when it has no failed step", () => {
        const undone = [record("s1", { status: "compensated" }), ...STEPS.slice(1)]
        expect(runViewOf(record("run-8", { status: "dead" }), undone).steps.some((step) => step.canResume)).toBe(false)
        expect(runViewOf(record("run-9", { status: "failed" }), STEPS.slice(0, 1)).steps[0]?.canResume).toBeUndefined()
        expect(runViewOf(record("run-3", { status: "parked" }), STEPS).steps.some((step) => step.canResume)).toBe(false)
    })

    it("has no parked step when a parked run has finished every step, and falls back to the record id for a step with no keys", () => {
        const view = runViewOf(record("run-6", { status: "parked" }), [record("s9", { status: "compensated" })])
        expect(view.steps).toEqual([
            {
                id: "s9",
                node: "s9",
                label: "s9",
                state: "done",
                at: null,
                inputSummary: "",
                outputSummary: "",
                durationMs: null,
                calls: [],
                effectKey: null,
                reason: null,
                approvalPath: null,
            },
        ])
    })
})
