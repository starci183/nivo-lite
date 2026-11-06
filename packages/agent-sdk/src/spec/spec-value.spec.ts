import { z } from "zod"
import {
    INSTALLATION_VARIABLE,
    optionalVariable,
    paramNameOf,
    resolveVariables,
    textOf,
    valueAt,
    variablesOf,
} from "./spec-value"

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

describe("paramNameOf", () => {
    it("is the name after the dollar of a text value, and null for anything else", () => {
        expect(paramNameOf("$q")).toBe("q")
        expect(paramNameOf("$")).toBe("")
        expect(paramNameOf(INSTALLATION_VARIABLE)).toBeNull()
        expect(paramNameOf("plain")).toBeNull()
        expect(paramNameOf(4)).toBeNull()
        expect(paramNameOf(null)).toBeNull()
    })
})

describe("resolveVariables", () => {
    const values: Readonly<Record<string, string | null>> = { q: "an", stage: "won" }
    const paramValue = (name: string): string | null => values[name] ?? null

    it("fills the installation and each param, and keeps other literals", () => {
        expect(
            resolveVariables(
                { id: INSTALLATION_VARIABLE, q: "$q", stage: "$stage", n: 3, flag: true },
                "inst-1",
                paramValue,
            ),
        ).toEqual({ variables: { id: "inst-1", q: "an", stage: "won", n: 3, flag: true }, pending: [] })
    })

    it("leaves a variable null and names it pending when its param has no value", () => {
        expect(resolveVariables({ id: "$selected", q: "$q" }, "inst-1", paramValue)).toEqual({
            variables: { id: null, q: "an" },
            pending: ["id"],
        })
    })

    it("leaves out a variable the read takes as optional when its param has no value", () => {
        expect(resolveVariables({ q: "$sort", id: "$selected" }, "inst-1", paramValue, (name) => name === "q")).toEqual(
            { variables: { id: null }, pending: ["id"] },
        )
    })

    it("is empty for a binding without variables", () => {
        expect(resolveVariables(undefined, "inst-1", paramValue)).toEqual({ variables: {}, pending: [] })
    })
})

describe("optionalVariable", () => {
    const read = { variables: z.object({ q: z.string().optional(), id: z.string() }) }

    it("is true for an optional variable and false for a required or unknown one", () => {
        expect(optionalVariable(read, "q")).toBe(true)
        expect(optionalVariable(read, "id")).toBe(false)
        expect(optionalVariable(read, "nope")).toBe(false)
    })
})
