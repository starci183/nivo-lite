import { Test } from "@nestjs/testing"

import { builder } from "@starci/jest-preset"

import type { Proposal } from "@modules/domain/work-items"
import type { AuthorityRule, GateInput } from "./authority-rules.contracts"

import {
    MIN_CONFIDENCE,
    ruleAmountOf as realRuleAmountOf,
    bandOf as realBandOf,
    evaluateGate as realEvaluateGate,
    hasBands as realHasBands,
    isOverLimit as realIsOverLimit,
    missingFields as realMissingFields,
} from "./gate.policy"

const SUBJECT = Symbol("gate.policy")

interface Subject {
    readonly ruleAmountOf: typeof realRuleAmountOf
    readonly bandOf: typeof realBandOf
    readonly evaluateGate: typeof realEvaluateGate
    readonly hasBands: typeof realHasBands
    readonly isOverLimit: typeof realIsOverLimit
    readonly missingFields: typeof realMissingFields
}

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
                    ruleAmountOf: realRuleAmountOf,
                    bandOf: realBandOf,
                    evaluateGate: realEvaluateGate,
                    hasBands: realHasBands,
                    isOverLimit: realIsOverLimit,
                    missingFields: realMissingFields,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)

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

describe("ruleAmountOf", () => {
    it("reads VND from the proposal itself and the other units from their number fields", async () => {
        const { subject } = await buildSubject()
        const proposal = proposalOf({ amount_vnd: 900, fields: { amount_percent: 12, amount_count: 3 } })

        expect(subject.ruleAmountOf(proposal, "vnd")).toBe(900)
        expect(subject.ruleAmountOf(proposal, "percent")).toBe(12)
        expect(subject.ruleAmountOf(proposal, "count")).toBe(3)
    })

    it("answers null when the proposal carries no number for the unit", async () => {
        const { subject } = await buildSubject()
        const proposal = proposalOf({ amount_vnd: null, fields: { amount_percent: "12", amount_count: null } })

        expect(subject.ruleAmountOf(proposal, "vnd")).toBeNull()
        expect(subject.ruleAmountOf(proposal, "percent")).toBeNull()
        expect(subject.ruleAmountOf(proposal, "count")).toBeNull()
    })
})

describe("bandOf", () => {
    const banded = ruleOf({ unit: "percent", auto_max: 3, ask_max: 15, limit_vnd: null })

    it("answers null for a rule without bands, whatever the amount", async () => {
        const { subject } = await buildSubject()

        expect(subject.hasBands(ruleOf())).toBe(false)
        expect(subject.bandOf(ruleOf({ limit_vnd: 5 }), 100)).toBeNull()
        expect(subject.bandOf(ruleOf({ auto_max: null, ask_max: null }), 100)).toBeNull()
    })

    it.each([
        [0, "auto"],
        [3, "auto"],
        [3.01, "ask"],
        [15, "ask"],
        [15.01, "never"],
    ] as const)("places %s in the %s band of 3 to 15", async (amount, band) => {
        const { subject } = await buildSubject()

        expect(subject.hasBands(banded)).toBe(true)
        expect(subject.bandOf(banded, amount)).toBe(band)
    })

    it("asks for every amount above the auto band when there is no upper bound", async () => {
        const { subject } = await buildSubject()
        const rule = ruleOf({ auto_max: 20_000_000, ask_max: null })

        expect(subject.bandOf(rule, 20_000_000)).toBe("auto")
        expect(subject.bandOf(rule, 900_000_000)).toBe("ask")
    })

    it("asks up to the upper bound and never above it when there is no auto band", async () => {
        const { subject } = await buildSubject()
        const rule = ruleOf({ auto_max: null, ask_max: 50, mode: "ask" })

        expect(subject.bandOf(rule, 0)).toBe("ask")
        expect(subject.bandOf(rule, 51)).toBe("never")
    })

    it("falls back to the mode of the rule when the proposal carries no amount", async () => {
        const { subject } = await buildSubject()

        expect(subject.bandOf(banded, null)).toBe("auto")
        expect(subject.bandOf({ ...banded, mode: "ask" }, null)).toBe("ask")
    })
})

describe("evaluateGate with bands", () => {
    const banded = ruleOf({ mode: "auto", unit: "percent", auto_max: 3, ask_max: 15, limit_vnd: null })
    const discount = (percent: number | null) => proposalOf({ fields: { amount_percent: percent } })

    it("runs alone inside the auto band", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ rule: banded, proposal: discount(3) })).verdict).toBe("auto")
    })

    it("asks inside the ask band and lets an approval through", async () => {
        const { subject } = await buildSubject()
        const input = inputOf({ rule: banded, proposal: discount(10) })

        expect(subject.evaluateGate(input).reasons).toEqual(["over_authority"])
        expect(subject.evaluateGate({ ...input, humanApproved: true }).verdict).toBe("auto")
    })

    it("refuses above the ask band, even for an approved item", async () => {
        const { subject } = await buildSubject()
        const input = inputOf({ rule: banded, proposal: discount(16) })

        expect(subject.evaluateGate(input).reasons).toEqual(["not_allowed"])
        expect(subject.evaluateGate({ ...input, humanApproved: true }).reasons).toEqual(["not_allowed"])
    })

    it("follows the mode when the proposal carries no amount", async () => {
        const { subject } = await buildSubject()

        expect(subject.evaluateGate(inputOf({ rule: banded, proposal: discount(null) })).verdict).toBe("auto")
        expect(
            subject.evaluateGate(inputOf({ rule: { ...banded, mode: "ask" }, proposal: discount(null) })).reasons,
        ).toEqual(["over_authority"])
    })

    it("counts VND bands in the amount of the proposal", async () => {
        const { subject } = await buildSubject()
        const rule = ruleOf({ auto_max: 20_000_000, ask_max: 100_000_000, limit_vnd: null })

        expect(subject.evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 20_000_000 }) })).verdict).toBe(
            "auto",
        )
        expect(
            subject.evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 20_000_001 }) })).reasons,
        ).toEqual(["over_authority"])
        expect(
            subject.evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 100_000_001 }) })).reasons,
        ).toEqual(["not_allowed"])
    })

    it("ignores the old VND limit for a rule counted in another unit", async () => {
        const { subject } = await buildSubject()
        const rule = ruleOf({ unit: "percent", limit_vnd: 10 })

        expect(subject.evaluateGate(inputOf({ rule, proposal: proposalOf({ amount_vnd: 50 }) })).verdict).toBe("auto")
    })

    it("keeps asking in assist mode, where the mode was lowered to ask, whatever band the amount is in", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.evaluateGate(inputOf({ rule: { ...banded, mode: "ask" }, proposal: discount(2) })).reasons,
        ).toEqual(["over_authority"])
    })
})
