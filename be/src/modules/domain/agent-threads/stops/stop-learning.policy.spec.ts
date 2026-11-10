import type { RunStop } from "./run-stop.contracts"
import { answeredOf, askedOf, judgedOf, verdictOf } from "./stop-learning.policy"

const stopOf = (over: Partial<RunStop>): RunStop => ({
    id: "s1",
    version: "1",
    runId: "r1",
    stepKey: "match",
    agentId: "a1",
    workflowId: "w1",
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "resolved",
    reason: "Mã không khớp đơn nào.",
    question: "Có ghi nhận không?",
    detail: { suggestions: [], facts: [] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: "2026-11-11T09:00:00.000Z",
    resolvedAt: null,
    ...over,
})

const answer = (text: string | null, at: string, kind: RunStop["answers"][number]["kind"] = "answer") => ({ kind, text, by: "m1", at })

describe("stop learning policy", () => {
    it("reads each free-text answer with what the step then did", () => {
        const first = answer("Ghi nhận", "2026-11-11T09:01:00.000Z")
        const second = answer("Ghi nhận cho đơn 0004", "2026-11-11T09:05:00.000Z")
        const stop = stopOf({ answers: [first, answer(null, "2026-11-11T09:02:00.000Z", "retry"), second], decision: second })

        expect(answeredOf(stop).map((one) => [one.text, one.thenDid])).toEqual([
            ["Ghi nhận", "stopped_again"],
            ["Ghi nhận cho đơn 0004", "completed"],
        ])
        expect(answeredOf(stopOf({ answers: [first, answer(null, "x", "skip")] }))[0]?.thenDid).toBe("skipped")
        expect(answeredOf(stopOf({ state: "open", answers: [first], decision: first }))).toEqual([])
        expect(answeredOf(stopOf({ state: "open", answers: [first], decision: null }))[0]?.thenDid).toBe("stopped_again")
        expect(answeredOf(stopOf({ kind: "approval", answers: [first] }))).toEqual([])
        expect(askedOf(stopOf({}))).toBe("Mã không khớp đơn nào. Có ghi nhận không?")
    })

    it("reads the judgement and the verdicts, refusing what is not the expected JSON", () => {
        expect(judgedOf('```json\n{"general": true}\n```')).toBe(true)
        expect(judgedOf("yes")).toBeNull()
        expect(verdictOf('{"verdict":"none"}')).toEqual({ verdict: "none" })
        expect(
            verdictOf('{"verdict":"draft","subject":"A","attribute":"B","value":"C","unit":null,"valid_to":"2026-11-18","topic":"T"}'),
        ).toEqual({
            verdict: "draft",
            factKey: { subjectLabel: "A", attributeLabel: "B" },
            value: "C",
            unit: null,
            validity: { from: null, to: "2026-11-18" },
            topic: "T",
        })
        expect(verdictOf('{"verdict":"contradiction","subject":"A","attribute":"B","topic":"T","answers":[1,1]}')).toBeNull()
        expect(verdictOf('{"verdict":"draft","subject":"A","attribute":"B","topic":"T"}')).toBeNull()
    })
})
