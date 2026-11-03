import { inputSourcesOf, isInputRef, resolveInput, sourceOfRef } from "./binding"

describe("node input bindings", () => {
    const bindings = {
        text: { $ref: "trigger.message.text" },
        total: { $ref: "price.total" },
        whole: { $ref: "price" },
        first: { $ref: "evidence.claims.0.id" },
        none: { $ref: "evidence.claims.1.id" },
        gone: { $ref: "price.missing.deep" },
        unknown: { $ref: "later.value" },
        payload: { orderId: { $ref: "price.orderId" }, lines: [{ name: { $ref: "trigger.items.0" } }, 2], note: null },
        tone: "warm",
    }

    it("tells a reference from a literal and names every source once, at any depth", () => {
        expect(isInputRef({ $ref: "trigger" })).toBe(true)
        expect(isInputRef({ other: 1 })).toBe(false)
        expect(isInputRef([1])).toBe(false)
        expect(isInputRef(null)).toBe(false)
        expect(sourceOfRef({ $ref: "price.total" })).toBe("price")
        expect(inputSourcesOf(bindings)).toEqual(["trigger", "price", "evidence", "later"])
    })

    it("resolves references at any depth, steps into lists, and answers null for a missing value", () => {
        const scope = {
            trigger: { message: { text: "hi" }, items: ["tea"] },
            steps: { price: { total: 5, orderId: "o1" }, evidence: { claims: [{ id: "c1" }] } },
        }
        expect(resolveInput(bindings, scope)).toEqual({
            text: "hi",
            total: 5,
            whole: { total: 5, orderId: "o1" },
            first: "c1",
            none: null,
            gone: null,
            unknown: null,
            payload: { orderId: "o1", lines: [{ name: "tea" }, 2], note: null },
            tone: "warm",
        })
    })
})
