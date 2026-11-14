import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { GRAPH_EXPR_INVALID as GRAPH_EXPR_INVALIDSubject, conditionBranchOf as conditionBranchOfSubject, resolvedConditionHolds as resolvedConditionHoldsSubject, storedExprProblems as storedExprProblemsSubject } from "./template-condition.policy"

const SUBJECT = Symbol("template-condition.policy")

describe("template-condition.policy built the way Nest does", () => {
    let GRAPH_EXPR_INVALID: typeof GRAPH_EXPR_INVALIDSubject
    let conditionBranchOf: typeof conditionBranchOfSubject
    let resolvedConditionHolds: typeof resolvedConditionHoldsSubject
    let storedExprProblems: typeof storedExprProblemsSubject

    beforeAll(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [{ provide: SUBJECT, useValue: mock<{ GRAPH_EXPR_INVALID: typeof GRAPH_EXPR_INVALIDSubject; conditionBranchOf: typeof conditionBranchOfSubject; resolvedConditionHolds: typeof resolvedConditionHoldsSubject; storedExprProblems: typeof storedExprProblemsSubject }>({ GRAPH_EXPR_INVALID: GRAPH_EXPR_INVALIDSubject, conditionBranchOf: conditionBranchOfSubject, resolvedConditionHolds: resolvedConditionHoldsSubject, storedExprProblems: storedExprProblemsSubject }) }],
        }).compile()
        ;({ GRAPH_EXPR_INVALID, conditionBranchOf, resolvedConditionHolds, storedExprProblems } = moduleRef.get<{ GRAPH_EXPR_INVALID: typeof GRAPH_EXPR_INVALIDSubject; conditionBranchOf: typeof conditionBranchOfSubject; resolvedConditionHolds: typeof resolvedConditionHoldsSubject; storedExprProblems: typeof storedExprProblemsSubject }>(SUBJECT))
    })

describe("the engine's if of a @2 graph", () => {
    it("reads a resolved leaf, all and any, exactly", () => {
        expect(resolvedConditionHolds({ ref: true, op: "eq", value: true })).toBe(true)
        expect(resolvedConditionHolds({ ref: 1, op: "eq", value: "1" })).toBe(false)
        expect(resolvedConditionHolds({ ref: null, op: "present" })).toBe(false)
        expect(resolvedConditionHolds({ ref: [], op: "absent" })).toBe(true)
        expect(resolvedConditionHolds({ ref: "2026-01-02", op: "gt", value: "2026-01-01" })).toBe(true)
        expect(resolvedConditionHolds({ ref: "10", op: "gt", value: 1 })).toBe(false)
        expect(
            resolvedConditionHolds({ all: [{ ref: false, op: "eq", value: false }, { ref: "INV-1", op: "present" }] }),
        ).toBe(true)
        expect(resolvedConditionHolds({ any: [{ ref: 1, op: "lt", value: 0 }, { ref: 2, op: "gte", value: 2 }] })).toBe(true)
    })

    it("reads the expression language (and / or / not) with the SDK's evaluator; a value shaped like a ref is still a value", () => {
        expect(resolvedConditionHolds({ and: [{ ref: 3, op: "gte", value: 3 }, { not: { ref: "", op: "present" } }] })).toBe(true)
        expect(resolvedConditionHolds({ or: [{ ref: 1, op: "eq", value: 2 }, { ref: 2, op: "eq", value: 2 }] })).toBe(true)
        expect(resolvedConditionHolds({ not: { ref: 1, op: "eq", value: 1 } })).toBe(false)
        expect(resolvedConditionHolds({ ref: { $ref: "x" }, op: "eq", value: { $ref: "x" } })).toBe(true)
        // An unknown truth (an order between a text and a number) does not hold, and neither does its `not`.
        expect(resolvedConditionHolds({ not: { ref: "10", op: "gt", value: 1 } })).toBe(false)
        expect(() => resolvedConditionHolds({ and: [] })).toThrow()
        expect(() => resolvedConditionHolds({ not: { not: { not: { not: { ref: 1, op: "eq", value: 1 } } } } })).toThrow()
    })

    it("re-validates a stored expression: its shape as the evaluator reads it, then the SDK's own validator", () => {
        expect(storedExprProblems({ op: "gte", ref: { $ref: "steps.a.output.n", default: null }, value: 3 })).toEqual([])
        expect(storedExprProblems({ all: [{ op: "present", ref: { $ref: "trigger.x" } }] })).toEqual([])
        expect(storedExprProblems({ op: "like", ref: { $ref: "x" }, value: 1 })).toEqual([{ code: GRAPH_EXPR_INVALID, at: "op" }])
        expect(storedExprProblems({ and: [{ op: "eq", ref: "x", value: 1 }] })).toEqual([{ code: GRAPH_EXPR_INVALID, at: "and.0.ref" }])
        expect(storedExprProblems({ or: [] })).toEqual([{ code: GRAPH_EXPR_INVALID, at: "or" }])
        expect(storedExprProblems({ op: "eq", ref: { $ref: "x" } })).toEqual([{ code: GRAPH_EXPR_INVALID, at: "value" }])
        // The SDK's validator: its bounds (at most 16 leaves).
        const leaves = Array.from({ length: 17 }, () => ({ op: "present", ref: { $ref: "trigger.x" } }))
        expect(storedExprProblems({ or: leaves })).toEqual([{ code: GRAPH_EXPR_INVALID, at: "" }])
    })

    it("answers the branch, and refuses a condition it cannot read", () => {
        expect(conditionBranchOf({ when: { ref: 3, op: "lte", value: 2 } })).toEqual({ branch: "no" })
        expect(() => conditionBranchOf({})).toThrow()
        expect(() => conditionBranchOf({ when: { ref: 1, op: "like", value: 1 } })).toThrow()
    })
})
})
