import type { RunStop } from "./run-stop.contracts"
import {
    STOP_END,
    endsTheRun,
    founderAnswersOf,
    stopAnswerOf,
    stopDecisionOf,
    stopEndCodeOf,
    stopQuestionOf,
    stopRouteOf,
    stopToldOf,
} from "./stop-gate.policy"

const GATE = "__freeze"

const STOP: RunStop = {
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "match",
    agentId: "agent-1",
    workflowId: null,
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "Kho\u1ea3n 500\u0111 cho \u0111\u01a1n 1.000\u0111",
    question: "Ghi nh\u1eadn hay ch\u1edd?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T10:00:00.000Z",
    resolvedAt: null,
}

const LINE = { conversationId: "conv-1", text: "D\u1ea1 ti\u1ec7m \u0111\u00e3 nh\u1eadn 500\u0111, \u0111ang ki\u1ec3m tra \u1ea1", at: "2026-11-10T10:00:05.000Z" }

describe("stopDecisionOf: only the five decisions move a stopped thread", () => {
    it("reads the founder's words, a button and a deadline", () => {
        expect(stopDecisionOf({ kind: "answer", text: " ghi nh\u1eadn ", by: "u1", at: "t" })).toEqual({
            kind: "answer",
            text: "ghi nh\u1eadn",
            by: "u1",
            at: "t",
        })
        expect(stopDecisionOf({ kind: "skip", by: "u1", at: "t" })).toMatchObject({ kind: "skip" })
        expect(stopDecisionOf({ kind: "timeout", at: "t" })).toEqual({ kind: "timeout", at: "t" })
    })

    it("refuses an empty answer, an unknown kind and anything that is not a decision", () => {
        expect(stopDecisionOf({ kind: "answer", text: "  ", by: "u1", at: "t" })).toBeNull()
        expect(stopDecisionOf({ kind: "approve", by: "u1", at: "t" })).toBeNull()
        expect(stopDecisionOf("retry")).toBeNull()
        expect(stopDecisionOf(null)).toBeNull()
    })
})

describe("stopRouteOf: where the gate sends the thread", () => {
    it("sends an answer back to the stopped step with every word the founder gave this stop, and keeps the stop open", () => {
        const before = { ...STOP, answers: [stopAnswerOf({ kind: "answer", text: "ch\u1edd kh\u00e1ch", by: "u1", at: "t1" })] }

        expect(stopRouteOf(before, { kind: "answer", text: "ghi nh\u1eadn lu\u00f4n", by: "u1", at: "t2" }, GATE)).toEqual({
            goto: "match",
            founderAnswers: [
                { text: "ch\u1edd kh\u00e1ch", at: "t1" },
                { text: "ghi nh\u1eadn lu\u00f4n", at: "t2" },
            ],
            resolves: false,
        })
    })

    it("sends a retry or a deadline back to the step with no new words, a take over back to the gate, and a skip to the end", () => {
        expect(stopRouteOf(STOP, { kind: "retry", by: "u1", at: "t" }, GATE)).toEqual({
            goto: "match",
            founderAnswers: [],
            resolves: false,
        })
        expect(stopRouteOf(STOP, { kind: "timeout", at: "t" }, GATE).goto).toBe("match")
        expect(stopRouteOf(STOP, { kind: "take_over", by: "u1", at: "t" }, GATE)).toMatchObject({
            goto: GATE,
            resolves: false,
        })
        expect(stopRouteOf(STOP, { kind: "skip", by: "u1", at: "t" }, GATE)).toMatchObject({ goto: STOP_END, resolves: true })
        // Rule S-3: a take-over handed back ends the run as a skip does, and is its own closing kind.
        expect(stopRouteOf(STOP, { kind: "handed_back", by: "u1", at: "t" }, GATE)).toMatchObject({ goto: STOP_END, resolves: true })
    })

    it("rule S-3: a hand-back is read as its own decision and ends the run with its own code; every other ending is the founder's skip", () => {
        expect(stopDecisionOf({ kind: "handed_back", by: "u1", at: "t" })).toEqual({ kind: "handed_back", by: "u1", at: "t" })
        expect(stopEndCodeOf({ kind: "handed_back" })).toBe("handed_back")
        expect(stopEndCodeOf({ kind: "skip" })).toBe("skipped_by_founder")
        expect(stopEndCodeOf(null)).toBe("skipped_by_founder")
        expect(["skip", "handed_back", "retry", "take_over", "answer", "timeout"].map((kind) => endsTheRun({ kind } as never))).toEqual([
            true,
            true,
            false,
            false,
            false,
            false,
        ])
    })

    it("keeps the founder's words only, oldest first", () => {
        expect(
            founderAnswersOf([
                stopAnswerOf({ kind: "retry", by: "u1", at: "t0" }),
                stopAnswerOf({ kind: "answer", text: "a", by: "u1", at: "t1" }),
                stopAnswerOf({ kind: "timeout", at: "t2" }),
            ]),
        ).toEqual([{ text: "a", at: "t1" }])
    })

    it("hands scope.stop plain JSON: the stop, the run, the step, why and the question", () => {
        expect(JSON.parse(JSON.stringify(stopQuestionOf(STOP)))).toEqual({
            stopId: "stop-1",
            runId: "run-1",
            stepKey: "match",
            kind: "ai_report",
            reason: STOP.reason,
            question: STOP.question,
        })
    })
})

describe("stopToldOf: what the customer was already told for this stop (FX2, D-P11-2)", () => {
    const EARLY = { conversationId: "conv-2", text: "D\u1ea1 ti\u1ec7m \u0111ang xem l\u1ea1i \u1ea1", at: "2026-11-10T10:00:01.000Z" }

    it("nothing told: null; told in any conversation: the newest line", () => {
        expect(stopToldOf(STOP)).toBeNull()
        expect(stopToldOf({ ...STOP, customerLines: [LINE, EARLY] })).toEqual(LINE)
    })

    it("a retry or a deadline keeps the line; the founder's words after it clear it, a line after the words counts again", () => {
        const retried = { ...STOP, customerLines: [LINE], answers: [stopAnswerOf({ kind: "retry", by: "u1", at: "2026-11-10T10:01:00.000Z" })] }
        expect(stopToldOf(retried)).toEqual(LINE)
        const answered = {
            ...retried,
            answers: [stopAnswerOf({ kind: "answer", text: "ghi nh\u1eadn", by: "u1", at: "2026-11-10T10:02:00.000Z" })],
        }
        expect(stopToldOf(answered)).toBeNull()
        const after = { ...LINE, text: "D\u1ea1 ti\u1ec7m \u0111\u00e3 ghi nh\u1eadn \u1ea1", at: "2026-11-10T10:03:00.000Z" }
        expect(stopToldOf({ ...answered, customerLines: [LINE, after] })).toEqual(after)
    })
})
