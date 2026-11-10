import type { RunStop } from "./run-stop.contracts"
import {
    STOP_END,
    founderAnswersOf,
    stopAnswerOf,
    stopDecisionOf,
    stopQuestionOf,
    stopRouteOf,
    stopSendRefusalOf,
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
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "Khoản 500đ cho đơn 1.000đ",
    question: "Ghi nhận hay chờ?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-10T10:00:00.000Z",
    resolvedAt: null,
}

const LINE = { conversationId: "conv-1", text: "Dạ tiệm đã nhận 500đ, đang kiểm tra ạ", at: "2026-11-10T10:00:05.000Z" }

describe("stopDecisionOf: only the five decisions move a stopped thread", () => {
    it("reads the founder's words, a button and a deadline", () => {
        expect(stopDecisionOf({ kind: "answer", text: " ghi nhận ", by: "u1", at: "t" })).toEqual({
            kind: "answer",
            text: "ghi nhận",
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
        const before = { ...STOP, answers: [stopAnswerOf({ kind: "answer", text: "chờ khách", by: "u1", at: "t1" })] }

        expect(stopRouteOf(before, { kind: "answer", text: "ghi nhận luôn", by: "u1", at: "t2" }, GATE)).toEqual({
            goto: "match",
            founderAnswers: [
                { text: "chờ khách", at: "t1" },
                { text: "ghi nhận luôn", at: "t2" },
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

describe("stopSendRefusalOf: one customer line per stop until the founder answers in words", () => {
    it("lets the first line go, and refuses a second to the same conversation while the stop is open", () => {
        expect(stopSendRefusalOf(STOP, "conv-1")).toBeNull()
        const told = { ...STOP, customerLines: [LINE] }
        expect(stopSendRefusalOf(told, "conv-1")).toEqual({ code: "already_told_for_this_stop", line: LINE })
        expect(stopSendRefusalOf(told, "conv-2")).toBeNull()
    })

    it("still refuses after a retry or a deadline, and lets the outcome line go after the founder's words", () => {
        const retried = {
            ...STOP,
            customerLines: [LINE],
            answers: [stopAnswerOf({ kind: "retry", by: "u1", at: "2026-11-10T10:01:00.000Z" })],
        }
        expect(stopSendRefusalOf(retried, "conv-1")).not.toBeNull()
        const answered = {
            ...retried,
            answers: [stopAnswerOf({ kind: "answer", text: "ghi nhận", by: "u1", at: "2026-11-10T10:02:00.000Z" })],
        }
        expect(stopSendRefusalOf(answered, "conv-1")).toBeNull()
    })

    it("refuses nothing once the stop is resolved, or when there is no stop", () => {
        expect(stopSendRefusalOf({ ...STOP, state: "resolved", customerLines: [LINE] }, "conv-1")).toBeNull()
        expect(stopSendRefusalOf(null, "conv-1")).toBeNull()
    })
})

describe("stopToldOf: what the customer was already told for this stop (FX2, D-P11-2)", () => {
    const EARLY = { conversationId: "conv-2", text: "Dạ tiệm đang xem lại ạ", at: "2026-11-10T10:00:01.000Z" }

    it("nothing told: null; told in any conversation: the newest line", () => {
        expect(stopToldOf(STOP)).toBeNull()
        expect(stopToldOf({ ...STOP, customerLines: [LINE, EARLY] })).toEqual(LINE)
    })

    it("a retry or a deadline keeps the line; the founder's words after it clear it, a line after the words counts again", () => {
        const retried = { ...STOP, customerLines: [LINE], answers: [stopAnswerOf({ kind: "retry", by: "u1", at: "2026-11-10T10:01:00.000Z" })] }
        expect(stopToldOf(retried)).toEqual(LINE)
        const answered = {
            ...retried,
            answers: [stopAnswerOf({ kind: "answer", text: "ghi nhận", by: "u1", at: "2026-11-10T10:02:00.000Z" })],
        }
        expect(stopToldOf(answered)).toBeNull()
        const after = { ...LINE, text: "Dạ tiệm đã ghi nhận ạ", at: "2026-11-10T10:03:00.000Z" }
        expect(stopToldOf({ ...answered, customerLines: [LINE, after] })).toEqual(after)
    })
})
