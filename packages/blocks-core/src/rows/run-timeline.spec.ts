import { RUN_PLACEHOLDER, durationText, runStepsOf, runWithSteps } from "./run-timeline"
import type { RunView } from "./run-timeline-view"

const CONTEXT = { locale: "en", currency: "VND", timeZone: "UTC" }

describe("durationText", () => {
    it("tells milliseconds under a second, seconds under a minute, else minutes and seconds", () => {
        expect(durationText(0, "en")).toBe("0 ms")
        expect(durationText(999.4, "en")).toBe("999 ms")
        expect(durationText(1000, "en")).toBe("1 s")
        expect(durationText(2400, "en")).toBe("2.4 s")
        expect(durationText(59_000, "en")).toBe("59 s")
        expect(durationText(60_000, "en")).toBe("1 m 00 s")
        expect(durationText(65_000, "en")).toBe("1 m 05 s")
        expect(durationText(3_725_000, "en")).toBe("62 m 05 s")
    })

    it("draws the decimals in the viewer's language", () => {
        expect(durationText(2400, "vi")).toBe("2,4 s")
    })
})

const RUN: RunView = {
    id: "r1",
    status: "parked",
    steps: [
        {
            id: "a",
            node: "n1",
            label: "First",
            state: "done",
            at: "2026-11-05T08:00:00.000Z",
            inputSummary: "in",
            outputSummary: "out",
            durationMs: 1500,
            calls: [
                { tool: "nivo.tool.customer.message.send", ok: true, summary: "sent" },
                { tool: "nivo.tool.ledger.entry.append", ok: false },
            ],
            effectKey: "k1",
            approvalPath: "/approvals/ignored",
        },
        { id: "b", node: "n2", label: "Second", state: "waiting", approvalPath: "/approvals/1" },
        { id: "c", node: "n3", label: "Third", state: "waiting" },
        { id: "d", node: "n4", label: "Fourth", state: "parked", reason: "no link", durationMs: null, calls: null },
        { id: "e", node: "n5", label: "Fifth", state: "parked" },
    ],
}

describe("runStepsOf", () => {
    const rows = runStepsOf(RUN, CONTEXT)

    it("draws one row per step, in order, under the node's name", () => {
        expect(rows.map((row) => [row.id, row.title])).toEqual([
            ["a", "First"],
            ["b", "Second"],
            ["c", "Third"],
            ["d", "Fourth"],
            ["e", "Fifth"],
        ])
    })

    it("tells the state of each step with its words key, tone and presentation", () => {
        expect(rows.map((row) => row.stateKey)).toEqual([
            "runStateDone",
            "runStateWaiting",
            "runStateWaiting",
            "runStateParked",
            "runStateParked",
        ])
        expect(rows[0]).toMatchObject({ tone: "success", presentation: "affirmative", isAttention: false })
        expect(rows[3]).toMatchObject({ tone: "warning", presentation: "cautionary", isAttention: true })
    })

    it("fills the summaries, the duration, the effect key, the reason and the time of a step that has them", () => {
        expect(rows[0]).toMatchObject({
            input: "in",
            output: "out",
            duration: "1.5 s",
            effectKey: "k1",
            reason: "",
            dateTime: "2026-11-05T08:00:00.000Z",
        })
        expect(rows[0]?.timeLabel).toContain("2026")
        expect(rows[3]).toMatchObject({ reason: "no link", duration: "" })
    })

    it("leaves what a step does not have empty", () => {
        expect(rows[2]).toMatchObject({
            dateTime: null,
            timeLabel: "",
            input: "",
            output: "",
            duration: "",
            effectKey: "",
            calls: [],
        })
    })

    it("lists the calls of a step with their verdict and a summary that may be empty", () => {
        expect(rows[0]?.calls).toEqual([
            { id: "a:0", tool: "nivo.tool.customer.message.send", ok: true, summary: "sent" },
            { id: "a:1", tool: "nivo.tool.ledger.entry.append", ok: false, summary: "" },
        ])
    })

    it("links only a waiting step, and only when it names its approval", () => {
        expect(rows.map((row) => row.approvalPath)).toEqual([null, "/approvals/1", null, null, null])
    })

    it("marks the last step current while it is running, waiting or parked, and no other", () => {
        expect(rows.map((row) => row.isCurrent)).toEqual([false, false, false, false, true])
        const running = runStepsOf(
            { id: "r", status: "running", steps: [{ id: "x", node: "n", label: "X", state: "running" }] },
            CONTEXT,
        )
        expect(running[0]?.isCurrent).toBe(true)
        const finished = runStepsOf(
            { id: "r", status: "done", steps: [{ id: "x", node: "n", label: "X", state: "done" }] },
            CONTEXT,
        )
        expect(finished[0]?.isCurrent).toBe(false)
        const failed = runStepsOf(
            { id: "r", status: "failed", steps: [{ id: "x", node: "n", label: "X", state: "failed" }] },
            CONTEXT,
        )
        expect(failed[0]?.isCurrent).toBe(false)
    })

    it("offers to run again on the first parked step only", () => {
        expect(rows.map((row) => row.canResume)).toEqual([false, false, false, true, false])
        expect(runStepsOf({ id: "r", status: "done", steps: [] }, CONTEXT)).toEqual([])
    })

    it("offers to run again on a failed step the read marked resumable, and on no other failed step", () => {
        const failed = runStepsOf(
            {
                id: "r",
                status: "failed",
                steps: [
                    { id: "x", node: "n", label: "X", state: "failed", canResume: true },
                    { id: "y", node: "n", label: "Y", state: "failed" },
                ],
            },
            CONTEXT,
        )
        expect(failed.map((row) => row.canResume)).toEqual([true, false])
    })
})

describe("RUN_PLACEHOLDER and runWithSteps", () => {
    it("holds steps with the geometry of settled ones", () => {
        expect(RUN_PLACEHOLDER.steps).toHaveLength(3)
        expect(runStepsOf(RUN_PLACEHOLDER, CONTEXT).every((row) => row.title !== "")).toBe(true)
    })

    it("keeps a run with steps and empties one without", () => {
        expect(runWithSteps(RUN)).toBe(RUN)
        expect(runWithSteps({ id: "r", status: "done", steps: [] })).toBeNull()
    })
})
