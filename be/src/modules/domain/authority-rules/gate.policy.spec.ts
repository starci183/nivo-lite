import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import type { Proposal } from "@modules/domain/work-items"
import type { AuthorityRule, GateInput } from "./authority-rules.contracts"

import {
    MIN_CONFIDENCE,
    evaluateGate as realEvaluateGate,
    isOverLimit as realIsOverLimit,
    missingFields as realMissingFields,
} from "./gate.policy"

const SUBJECT = Symbol("gate.policy")

const functions = { evaluateGate: realEvaluateGate, isOverLimit: realIsOverLimit, missingFields: realMissingFields }

const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "confirm_order",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})

const proposalOf = builder<Proposal>({ summary: "Confirm the order", fields: {} })

const inputOf = builder<GateInput>({
    action: "confirm_order",
    rule: ruleOf(),
    maxMode: null,
    proposal: proposalOf(),
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    evaluateGate: realEvaluateGate,
                    isOverLimit: realIsOverLimit,
                    missingFields: realMissingFields,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("isOverLimit", () => {
    it.each([
        [100, 100, true],
        [100, 99, false],
        [100, 101, true],
        [null, 5_000, false],
        [undefined, 5_000, false],
        [100, null, false],
        [100, undefined, false],
    ] as const)("answers limit %s amount %s as %s", async (limit, amount, expected) => {
        const { subject } = await buildSubject()

        expect(subject.isOverLimit(limit, amount)).toBe(expected)
    })
})

describe("missingFields", () => {
    it("is empty without a rule", async () => {
        const { subject } = await buildSubject()

        expect(subject.missingFields(null, proposalOf())).toEqual([])
    })

    it("lists blank, absent and null fields", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ required_fields: ["customer", "items", "need", "contact"] })
        const proposal = proposalOf({ fields: { customer: "  ", items: null, contact: "0900" } })

        expect(subject.missingFields(rule, proposal)).toEqual(["customer", "items", "need"])
    })

    it("reads the amount from the proposal first and from the fields second", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ required_fields: ["amount_vnd"] })

        expect(subject.missingFields(rule, proposalOf({ amount_vnd: 10 }))).toEqual([])
        expect(subject.missingFields(rule, proposalOf({ fields: { amount_vnd: 10 } }))).toEqual([])
        expect(subject.missingFields(rule, proposalOf({ amount_vnd: null }))).toEqual(["amount_vnd"])
    })

    it("treats a zero as present", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.missingFields(ruleOf({ required_fields: ["amount_vnd"] }), proposalOf({ amount_vnd: 0 })),
        ).toEqual([])
    })
})

describe("evaluateGate", () => {
    it("runs a routine action alone", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf())).toEqual({
            verdict: "auto",
            reason: "routine",
            reasons: ["routine"],
            missing: [],
        })
    })
    it("asks when no rule was granted", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ rule: null }))).toEqual({
            verdict: "ask",
            reason: "not_allowed",
            reasons: ["not_allowed"],
            missing: [],
        })
    })
    it("asks when the rule is never, even for an approved item", async () => {
        const { subject } = await buildSubject()

        const verdict = subject.evaluateGate(inputOf({ rule: ruleOf({ mode: "never" }), humanApproved: true }))

        expect(verdict.reasons).toEqual(["not_allowed"])
    })
    it("asks for missing data and cannot be approved around it", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ required_fields: ["customer"] })

        expect(subject.evaluateGate(inputOf({ rule }))).toEqual({
            verdict: "ask",
            reason: "missing_data",
            reasons: ["missing_data"],
            missing: ["customer"],
        })
        expect(subject.evaluateGate(inputOf({ rule, humanApproved: true })).reasons).toEqual(["missing_data"])
    })
    it("asks when the amount reaches the limit and lets an approval through", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ limit_vnd: 1_000 })
        const proposal = proposalOf({ amount_vnd: 1_000 })

        expect(subject.evaluateGate(inputOf({ rule, proposal })).reasons).toEqual(["over_authority"])
        expect(subject.evaluateGate(inputOf({ rule, proposal, humanApproved: true })).verdict).toBe("auto")
        expect(subject.evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 999 }) })).verdict).toBe("auto")
    })
})

describe("evaluateGate", () => {
    it("asks for a low confidence", async () => {
        const { subject } = await buildSubject()

        const low = proposalOf({ confidence: MIN_CONFIDENCE - 0.01 })

        expect(subject.evaluateGate(inputOf({ proposal: low })).reasons).toEqual(["unclear_outcome"])
        expect(subject.evaluateGate(inputOf({ proposal: proposalOf({ confidence: MIN_CONFIDENCE }) })).verdict).toBe(
            "auto",
        )
    })
    it("asks for an unclear outcome", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ proposal: proposalOf({ outcome: "unclear" }) })).reasons).toEqual([
            "unclear_outcome",
        ])
    })
    it("asks unless exactly one candidate matches", async () => {
        const { subject } = await buildSubject()

        const candidate = { id: "inv-1", label: "INV-1", amount_vnd: 10 }

        expect(subject.evaluateGate(inputOf({ proposal: proposalOf({ candidates: [] }) })).reasons).toEqual([
            "unclear_outcome",
        ])
        expect(
            subject.evaluateGate(
                inputOf({ proposal: proposalOf({ candidates: [candidate, { ...candidate, id: "inv-2" }] }) }),
            ).reasons,
        ).toEqual(["unclear_outcome"])
        expect(subject.evaluateGate(inputOf({ proposal: proposalOf({ candidates: [candidate] }) })).verdict).toBe(
            "auto",
        )
    })
    it("asks in ask mode and lets an approval through", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ mode: "ask" })

        expect(subject.evaluateGate(inputOf({ rule })).reasons).toEqual(["over_authority"])
        expect(subject.evaluateGate(inputOf({ rule, humanApproved: true })).verdict).toBe("auto")
    })
})

describe("evaluateGate", () => {
    it("collects every reason once, in precedence order", async () => {
        const { subject } = await buildSubject()

        const rule = ruleOf({ mode: "ask", limit_vnd: 10, required_fields: ["customer"] })
        const proposal = proposalOf({ amount_vnd: 50, confidence: 0.1 })

        expect(subject.evaluateGate(inputOf({ rule, proposal }))).toEqual({
            verdict: "ask",
            reason: "missing_data",
            reasons: ["missing_data", "over_authority", "unclear_outcome"],
            missing: ["customer"],
        })
    })

    it("caps an auto rule at the mode the registry allows", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ maxMode: "ask" })).reasons).toEqual(["over_authority"])
        expect(subject.evaluateGate(inputOf({ maxMode: "never" })).reasons).toEqual(["not_allowed"])
    })

    it("leaves a rule that is not auto alone when a cap exists", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ rule: ruleOf({ mode: "ask" }), maxMode: "never" })).reasons).toEqual([
            "over_authority",
        ])
    })

    it("ignores the cap when there is no rule", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ rule: null, maxMode: "ask" })).reasons).toEqual(["not_allowed"])
    })
})
