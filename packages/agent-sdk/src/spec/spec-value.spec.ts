import { INSTALLATION_VARIABLE, textOf, valueAt, variablesOf } from "./spec-value"

describe("valueAt", () => {
    it("is the value itself for an absent or empty path", () => {
        const value = { a: 1 }
        expect(valueAt(value, undefined)).toBe(value)
        expect(valueAt(value, "")).toBe(value)
    })

    it("walks a dotted path and is undefined where a step is missing or not a record", () => {
        const value = { stats: { members: 3 }, list: [1] }
        expect(valueAt(value, "stats.members")).toBe(3)
        expect(valueAt(value, "stats.gone.deeper")).toBeUndefined()
        expect(valueAt(value, "list.0")).toBeUndefined()
        expect(valueAt(null, "a")).toBeUndefined()
    })
})

describe("textOf", () => {
    it("keeps strings and finite numbers, and empties anything else", () => {
        expect(textOf("a")).toBe("a")
        expect(textOf(4)).toBe("4")
        expect(textOf(Number.NaN)).toBe("")
        expect(textOf({})).toBe("")
    })
})

describe("variablesOf", () => {
    it("puts the route installation in and keeps other literals", () => {
        expect(variablesOf({ id: INSTALLATION_VARIABLE, q: "x", n: null }, "inst-1")).toEqual({
            id: "inst-1",
            q: "x",
            n: null,
        })
        expect(variablesOf(undefined, "inst-1")).toEqual({})
    })
})
