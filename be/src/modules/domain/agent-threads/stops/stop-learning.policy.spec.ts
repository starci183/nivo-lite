import { Test } from "@nestjs/testing"
import {
    BOOK_IT_QUESTION_VI,
    BOOK_IT_VI,
    BOOK_ORDER_FOUR_VI,
    CODE_MISMATCH_REASON_VI,
    ENGINE_REFUSAL_HEAD_VI,
    QR_ALLOWED_ANSWER_VI,
} from "@tests/fixtures/i18n/agent-threads-spec.messages"
import type { RunStop } from "./run-stop.contracts"
import { answeredOf, askedOf, modelJsonOf, stopRefOf } from "./stop-learning.policy"

const SUBJECT = Symbol("stop-learning.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { answeredOf, askedOf, stopRefOf, modelJsonOf } }],
    }).compile()
    return moduleRef.get<typeof import("./stop-learning.policy")>(SUBJECT)
}

const stopOf = (over: Partial<RunStop>): RunStop => ({
    id: "s1",
    version: "1",
    runId: "r1",
    stepKey: "match",
    agentId: "a1",
    workflowId: "w1",
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state: "resolved",
    reason: CODE_MISMATCH_REASON_VI,
    question: BOOK_IT_QUESTION_VI,
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

const answer = (text: string | null, at: string, kind: RunStop["answers"][number]["kind"] = "answer") => ({
    kind,
    text,
    by: "m1",
    at,
})

describe("stop learning policy", () => {
    it("reads each free-text answer with what the step then did", async () => {
        const policy = await build()
        const first = answer(BOOK_IT_VI, "2026-11-11T09:01:00.000Z")
        const second = answer(BOOK_ORDER_FOUR_VI, "2026-11-11T09:05:00.000Z")
        const stop = stopOf({
            answers: [first, answer(null, "2026-11-11T09:02:00.000Z", "retry"), second],
            decision: second,
        })

        expect(policy.answeredOf(stop).map((one) => [one.text, one.thenDid])).toEqual([
            [BOOK_IT_VI, "stopped_again"],
            [BOOK_ORDER_FOUR_VI, "completed"],
        ])
        expect(policy.answeredOf(stopOf({ answers: [first, answer(null, "x", "skip")] }))[0]?.thenDid).toBe("skipped")
        expect(policy.answeredOf(stopOf({ state: "open", answers: [first], decision: first }))).toEqual([])
        expect(policy.answeredOf(stopOf({ state: "open", answers: [first], decision: null }))[0]?.thenDid).toBe(
            "stopped_again",
        )
        expect(policy.answeredOf(stopOf({ kind: "approval", answers: [first] }))).toEqual([])
        expect(policy.askedOf(stopOf({}))).toBe(`${CODE_MISMATCH_REASON_VI} ${BOOK_IT_QUESTION_VI}`)
    })

    it("D-MX-8: an answer that carries an identifier of the engine (the refusal an approval stop folded in) is no person's answer", async () => {
        const policy = await build()
        const refusal = answer(ENGINE_REFUSAL_HEAD_VI, "2026-11-11T09:14:00.000Z")
        const said = answer(QR_ALLOWED_ANSWER_VI, "2026-11-11T09:16:00.000Z")

        expect(policy.answeredOf(stopOf({ answers: [refusal, said], decision: said })).map((one) => one.text)).toEqual([
            QR_ALLOWED_ANSWER_VI,
        ])
    })

    it("reads the model's JSON out of fences, or null when there is none", async () => {
        const policy = await build()

        expect(policy.modelJsonOf('```json {"groups":[]} ```')).toEqual({ groups: [] })
        expect(policy.modelJsonOf("no json here")).toBeNull()
        expect(policy.modelJsonOf("{not json}")).toBeNull()
        expect(policy.stopRefOf("r1", "match")).toBe("run:r1/step:match")
    })
})
