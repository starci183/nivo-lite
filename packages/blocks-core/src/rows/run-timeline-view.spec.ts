import { RUN_STEPS_MAX } from "./graph-view"
import { RUN_CALLS_MAX, runView } from "./run-timeline-view"

const STEP = { id: "s1", node: "n1", label: "Nhan tin", state: "done" }
const accepts = (value: unknown): boolean => runView.safeParse(value).success
const run = (step: Record<string, unknown>): unknown => ({ id: "r1", status: "parked", steps: [{ ...STEP, ...step }] })

describe("runView", () => {
    it("takes a run with its steps and keeps the fields it does not know", () => {
        const parsed = runView.parse({ id: "r1", status: "done", steps: [STEP], agent: "a1" })
        expect(parsed.steps).toEqual([STEP])
        expect(parsed).toMatchObject({ agent: "a1" })
    })

    it("takes every optional field of a step, present or null", () => {
        const full = {
            at: "2026-11-05T08:00:00.000Z",
            inputSummary: "in",
            outputSummary: "out",
            durationMs: 12,
            calls: [
                { tool: "nivo.chat.send", ok: false, summary: "loi" },
                { tool: "x.y", ok: true },
            ],
            effectKey: "k",
            reason: "why",
            approvalPath: "/approvals/1",
        }
        expect(accepts(run(full))).toBe(true)
        const nulls = Object.fromEntries(Object.keys(full).map((key) => [key, null]))
        expect(accepts(run(nulls))).toBe(true)
        expect(accepts(run({ calls: [{ tool: "x.y", ok: true, summary: null }] }))).toBe(true)
    })

    it("refuses a missing id, an unknown state, a negative or fractional duration and a call without a verdict", () => {
        expect(accepts({ status: "done", steps: [] })).toBe(false)
        expect(accepts({ id: "r1", status: "idle", steps: [] })).toBe(false)
        expect(accepts(run({ state: "idle" }))).toBe(false)
        expect(accepts(run({ durationMs: -1 }))).toBe(false)
        expect(accepts(run({ durationMs: 1.5 }))).toBe(false)
        expect(accepts(run({ calls: [{ tool: "x.y" }] }))).toBe(false)
        expect(accepts(run({ id: "" }))).toBe(false)
    })

    it("refuses too many steps, too many calls and text past its length", () => {
        expect(
            accepts({ id: "r1", status: "done", steps: Array.from({ length: RUN_STEPS_MAX + 1 }, () => STEP) }),
        ).toBe(false)
        const calls = Array.from({ length: RUN_CALLS_MAX + 1 }, () => ({ tool: "x.y", ok: true }))
        expect(accepts(run({ calls }))).toBe(false)
        expect(accepts(run({ inputSummary: "x".repeat(501) }))).toBe(false)
        expect(accepts(run({ approvalPath: "/".repeat(301) }))).toBe(false)
    })
})
