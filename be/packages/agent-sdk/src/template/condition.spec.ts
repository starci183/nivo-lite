import type { Condition } from "./graph.types"
import { leavesOf, withLeafValue } from "./condition"

const term = (value: number): Condition => ({ fact: "amount", op: "lt", value })
const NESTED: Condition = { all: [term(1), { any: [term(2), { fact: "kind", op: "known" }, term(3)] }] }

describe("leavesOf", () => {
    it("reads the terms of a condition in order, groups opened", () => {
        expect(leavesOf(NESTED)).toEqual([term(1), term(2), { fact: "kind", op: "known" }, term(3)])
        expect(leavesOf(term(5))).toEqual([term(5)])
    })
})

describe("withLeafValue", () => {
    it("replaces the number of the nth term, however deep, and nothing else", () => {
        expect(withLeafValue(NESTED, 3, 9)).toEqual({
            all: [term(1), { any: [term(2), { fact: "kind", op: "known" }, term(9)] }],
        })
        expect(withLeafValue(NESTED, 0, 7)).toEqual({
            all: [term(7), { any: [term(2), { fact: "kind", op: "known" }, term(3)] }],
        })
        expect(withLeafValue(term(1), 0, 4)).toEqual(term(4))
    })

    it("leaves the condition as it is when the term at that place has no number to set", () => {
        const listed: Condition = { fact: "kind", op: "in", value: ["a"] }

        expect(withLeafValue(NESTED, 2, 9)).toEqual(NESTED)
        expect(withLeafValue(NESTED, 40, 9)).toEqual(NESTED)
        expect(withLeafValue(listed, 0, 9)).toEqual(listed)
    })
})
