import { conditionBranchOf, resolvedConditionHolds, storedExprProblems } from "./template-condition.policy"

// `contains` through the engine's one adapter to the SDK's evaluator (`core.when`): resolved refs, the declared `caseFold`, the save check.
describe("core.when: contains", () => {
    it("holds an exact substring of two resolved texts, case as given", () => {
        expect(resolvedConditionHolds({ op: "contains", ref: "CK DH A12", value: "A12" })).toBe(true)
        expect(resolvedConditionHolds({ op: "contains", ref: "CK DH A12", value: "a12" })).toBe(false)
    })

    it("folds both texts when the leaf declares caseFold", () => {
        expect(conditionBranchOf({ when: { op: "contains", ref: "CK DH A12", value: "dh a12", caseFold: true } })).toEqual({ branch: "yes" })
    })

    it("a side that is no text does not hold", () => {
        expect(resolvedConditionHolds({ op: "contains", ref: 12, value: "1" })).toBe(false)
    })

    it("equals over two resolved integers", () => {
        expect(resolvedConditionHolds({ op: "eq", ref: 3, value: 3 })).toBe(true)
    })

    it("the save reads a stored contains leaf (its typed check is the SDK's templateGraphProblems: refs are untyped here)", () => {
        expect(storedExprProblems({ op: "contains", ref: { $ref: "trigger.text" }, value: { $ref: "steps.a.output.code" } })).toEqual([])
        expect(storedExprProblems({ op: "contains", ref: { $ref: "trigger.text" }, value: "x", caseFold: true })).toEqual([])
        expect(storedExprProblems({ op: "contains", ref: { $ref: "trigger.text" } })).toEqual([{ code: "GRAPH_EXPR_INVALID", at: "value" }])
    })
})
