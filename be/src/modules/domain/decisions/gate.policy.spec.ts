import { builder } from "@starci/jest-preset"
import type { AuthorityRule, GateInput, Proposal } from "./decisions.contracts"
import { MIN_CONFIDENCE, evaluateGate, isOverLimit, missingFields } from "./gate.policy"

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

describe("isOverLimit", () => {
    it.each([
        [100, 100, true],
        [100, 99, false],
        [100, 101, true],
        [null, 5_000, false],
        [undefined, 5_000, false],
        [100, null, false],
        [100, undefined, false],
    ] as const)("answers limit %s amount %s as %s", (limit, amount, expected) => {
        expect(isOverLimit(limit, amount)).toBe(expected)
    })
})

describe("missingFields", () => {
    it("is empty without a rule", () => {
        expect(missingFields(null, proposalOf())).toEqual([])
    })

    it("lists blank, absent and null fields", () => {
        const rule = ruleOf({ required_fields: ["customer", "items", "need", "contact"] })
        const proposal = proposalOf({ fields: { customer: "  ", items: null, contact: "0900" } })

        expect(missingFields(rule, proposal)).toEqual(["customer", "items", "need"])
    })

    it("reads the amount from the proposal first and from the fields second", () => {
        const rule = ruleOf({ required_fields: ["amount_vnd"] })

        expect(missingFields(rule, proposalOf({ amount_vnd: 10 }))).toEqual([])
        expect(missingFields(rule, proposalOf({ fields: { amount_vnd: 10 } }))).toEqual([])
        expect(missingFields(rule, proposalOf({ amount_vnd: null }))).toEqual(["amount_vnd"])
    })

    it("treats a zero as present", () => {
        expect(missingFields(ruleOf({ required_fields: ["amount_vnd"] }), proposalOf({ amount_vnd: 0 }))).toEqual([])
    })
})

describe("evaluateGate", () => {
    it("runs a routine action alone", () => {
        expect(evaluateGate(inputOf())).toEqual({
            verdict: "auto",
            reason: "routine",
            reasons: ["routine"],
            missing: [],
        })
    })

    it("asks when no rule was granted", () => {
        expect(evaluateGate(inputOf({ rule: null }))).toEqual({
            verdict: "ask",
            reason: "not_allowed",
            reasons: ["not_allowed"],
            missing: [],
        })
    })

    it("asks when the rule is never, even for an approved item", () => {
        const verdict = evaluateGate(inputOf({ rule: ruleOf({ mode: "never" }), humanApproved: true }))

        expect(verdict.reasons).toEqual(["not_allowed"])
    })

    it("asks for missing data and cannot be approved around it", () => {
        const rule = ruleOf({ required_fields: ["customer"] })

        expect(evaluateGate(inputOf({ rule }))).toEqual({
            verdict: "ask",
            reason: "missing_data",
            reasons: ["missing_data"],
            missing: ["customer"],
        })
        expect(evaluateGate(inputOf({ rule, humanApproved: true })).reasons).toEqual(["missing_data"])
    })

    it("asks when the amount reaches the limit and lets an approval through", () => {
        const rule = ruleOf({ limit_vnd: 1_000 })
        const proposal = proposalOf({ amount_vnd: 1_000 })

        expect(evaluateGate(inputOf({ rule, proposal })).reasons).toEqual(["over_authority"])
        expect(evaluateGate(inputOf({ rule, proposal, humanApproved: true })).verdict).toBe("auto")
        expect(evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 999 }) })).verdict).toBe("auto")
    })

    it("asks for a low confidence", () => {
        const low = proposalOf({ confidence: MIN_CONFIDENCE - 0.01 })

        expect(evaluateGate(inputOf({ proposal: low })).reasons).toEqual(["unclear_outcome"])
        expect(evaluateGate(inputOf({ proposal: proposalOf({ confidence: MIN_CONFIDENCE }) })).verdict).toBe("auto")
    })

    it("asks for an unclear outcome", () => {
        expect(evaluateGate(inputOf({ proposal: proposalOf({ outcome: "unclear" }) })).reasons).toEqual([
            "unclear_outcome",
        ])
    })

    it("asks unless exactly one candidate matches", () => {
        const candidate = { id: "inv-1", label: "INV-1", amount_vnd: 10 }

        expect(evaluateGate(inputOf({ proposal: proposalOf({ candidates: [] }) })).reasons).toEqual(["unclear_outcome"])
        expect(
            evaluateGate(inputOf({ proposal: proposalOf({ candidates: [candidate, { ...candidate, id: "inv-2" }] }) }))
                .reasons,
        ).toEqual(["unclear_outcome"])
        expect(evaluateGate(inputOf({ proposal: proposalOf({ candidates: [candidate] }) })).verdict).toBe("auto")
    })

    it("asks in ask mode and lets an approval through", () => {
        const rule = ruleOf({ mode: "ask" })

        expect(evaluateGate(inputOf({ rule })).reasons).toEqual(["over_authority"])
        expect(evaluateGate(inputOf({ rule, humanApproved: true })).verdict).toBe("auto")
    })

    it("collects every reason once, in precedence order", () => {
        const rule = ruleOf({ mode: "ask", limit_vnd: 10, required_fields: ["customer"] })
        const proposal = proposalOf({ amount_vnd: 50, confidence: 0.1 })

        expect(evaluateGate(inputOf({ rule, proposal }))).toEqual({
            verdict: "ask",
            reason: "missing_data",
            reasons: ["missing_data", "over_authority", "unclear_outcome"],
            missing: ["customer"],
        })
    })

    it("caps an auto rule at the mode the registry allows", () => {
        expect(evaluateGate(inputOf({ maxMode: "ask" })).reasons).toEqual(["over_authority"])
        expect(evaluateGate(inputOf({ maxMode: "never" })).reasons).toEqual(["not_allowed"])
    })

    it("leaves a rule that is not auto alone when a cap exists", () => {
        expect(evaluateGate(inputOf({ rule: ruleOf({ mode: "ask" }), maxMode: "never" })).reasons).toEqual([
            "over_authority",
        ])
    })

    it("ignores the cap when there is no rule", () => {
        expect(evaluateGate(inputOf({ rule: null, maxMode: "ask" })).reasons).toEqual(["not_allowed"])
    })
})
