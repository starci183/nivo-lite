import { builder } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import {
    ANSWER_PENDING_ORDER_VI,
    ANSWER_RECORD_VI,
    ANSWER_REFUND_VI,
    CONTACTS_MASKED_VI,
    CONTACTS_RAW_VI,
    DONG_VI,
    LINE_IGNORE_INSTRUCTIONS_VI,
    NAMES_NO_CUSTOMER_VI,
    NAMES_ORDER_CODE_VI,
    PRICE_30K_VI,
    REASON_CONTRADICTION_PART_VI,
    REASON_LEARNED_VI,
    RULE_DELIVERY_FEE_VI,
    RULE_PAID_TWICE_VI,
    RULE_VAT_FEE_VI,
    TEXT_SNAKE_KEY_VI,
    TEXT_TOOL_ID_VI,
    TOPIC_WRONG_CODE_VI,
    WORDS_RECORD_VI,
} from "@tests/fixtures/i18n/brain-lessons-spec.messages"
import type { LessonCandidate } from "./lesson-candidates.contracts"
import {
    contradictionReasonOf,
    learnedReasonOf,
    lessonTextOk,
    lessonValueOf,
    maskedOf,
    namesCustomerData,
    namesInternalIds,
    onlyIdentifiers,
} from "./lesson-candidates.policy"

const SUBJECT = Symbol("lesson-candidates.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    contradictionReasonOf,
                    learnedReasonOf,
                    lessonTextOk,
                    lessonValueOf,
                    maskedOf,
                    namesCustomerData,
                    namesInternalIds,
                    onlyIdentifiers,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./lesson-candidates.policy")>(SUBJECT)
}

const candidateOf = builder<LessonCandidate>({
    id: "c1",
    stopId: "s1",
    runId: "r1",
    agentId: "a1",
    workflowId: "w1",
    stepKey: "match",
    question: "",
    answer: ANSWER_PENDING_ORDER_VI,
    answeredBy: "m1",
    answeredAt: "2026-11-10T09:00:00.000Z",
    thenDid: "completed",
    general: null,
    groupId: "g1",
    status: "candidate",
    changeId: null,
    factKey: null,
    factId: null,
})

describe("lesson candidates policy", () => {
    it("exports no reading of words: grouping, agreement and the draft check are the draft call's (lesson-groups.policy)", async () => {
        const subject = await build()

        expect(Object.keys(subject).toSorted()).toEqual([
            "contradictionReasonOf",
            "learnedReasonOf",
            "lessonTextOk",
            "lessonValueOf",
            "maskedOf",
            "namesCustomerData",
            "namesInternalIds",
            "onlyIdentifiers",
        ])
    })

    describe("masking and drafted words", () => {
        it("masks phones and e-mails and spots customer data in a drafted truth", async () => {
            const subject = await build()

            expect(subject.maskedOf(CONTACTS_RAW_VI, 200)).toBe(CONTACTS_MASKED_VI)
            expect(subject.namesCustomerData(NAMES_ORDER_CODE_VI)).toBe(true)
            expect(subject.namesCustomerData(NAMES_NO_CUSTOMER_VI)).toBe(false)
        })

        it("writes the reasons in plain Vietnamese", async () => {
            const subject = await build()
            const older = candidateOf({ answer: ANSWER_RECORD_VI })
            const newer = candidateOf({ answer: ANSWER_REFUND_VI, answeredAt: "2026-11-11T09:00:00.000Z" })

            expect(subject.learnedReasonOf(TOPIC_WRONG_CODE_VI, [older, older])).toBe(REASON_LEARNED_VI)
            expect(subject.contradictionReasonOf(TOPIC_WRONG_CODE_VI, [older, newer], older, newer)).toContain(
                REASON_CONTRADICTION_PART_VI,
            )
        })
    })
})

describe("lesson candidates policy: what a lesson may say", () => {
    describe("D-MX-8: what a lesson may say", () => {
        it("(b): engine identifiers are no shop words; a text of identifiers only is refused", async () => {
            const subject = await build()

            expect(subject.namesInternalIds(TEXT_TOOL_ID_VI)).toBe(true)
            expect(subject.namesInternalIds(TEXT_SNAKE_KEY_VI)).toBe(true)
            expect(subject.namesInternalIds("run 1aaedeaf-0000-4000-8000-000000000000")).toBe(true)
            expect(subject.namesInternalIds("xem brain-change:96380be6")).toBe(true)
            expect(subject.namesInternalIds(RULE_PAID_TWICE_VI)).toBe(false)
            expect(subject.lessonTextOk("nivo.tool.payment.transfer.create")).toBe(false)
            expect(subject.lessonTextOk(RULE_DELIVERY_FEE_VI)).toBe(true)
            // No code decides that a text addresses an AI: such a line is words like any other here.
            expect(subject.lessonTextOk(LINE_IGNORE_INSTRUCTIONS_VI)).toBe(true)
        })

        it("(c): a drafted value goes through the store's one value + unit form", async () => {
            const subject = await build()

            expect(subject.lessonValueOf({ value: RULE_PAID_TWICE_VI, unit: DONG_VI })).toEqual({
                value: RULE_PAID_TWICE_VI,
                unit: null,
            })
            expect(subject.lessonValueOf({ value: RULE_VAT_FEE_VI, unit: "%" })).toEqual({
                value: `${RULE_VAT_FEE_VI} %`,
                unit: null,
            })
            expect(subject.lessonValueOf({ value: "30.000", unit: DONG_VI })).toEqual({ value: "30.000", unit: DONG_VI })
            expect(subject.lessonValueOf({ value: PRICE_30K_VI, unit: DONG_VI })).toEqual({ value: PRICE_30K_VI, unit: DONG_VI })
            expect(subject.lessonValueOf({ value: WORDS_RECORD_VI, unit: null })).toEqual({ value: WORDS_RECORD_VI, unit: null })
        })
    })
})
