import { inputSourcesOf, isInputRef, resolveInput, sourceOfRef } from "./binding"

describe("node input bindings", () => {
    const bindings = {
        text: { $ref: "trigger.message.text" },
        total: { $ref: "price.total" },
        whole: { $ref: "price" },
        gone: { $ref: "price.missing.deep" },
        unknown: { $ref: "later.value" },
        tone: "warm",
        list: [1, 2],
        none: null,
    }

    it("tells a reference from a literal and names its source once", () => {
        expect(isInputRef({ $ref: "trigger" })).toBe(true)
        expect(isInputRef({ other: 1 })).toBe(false)
        expect(isInputRef([1])).toBe(false)
        expect(isInputRef(null)).toBe(false)
        expect(sourceOfRef({ $ref: "price.total" })).toBe("price")
        expect(inputSourcesOf({ ...bindings, again: { $ref: "price.x" } })).toEqual(["trigger", "price", "later"])
    })

    it("fills literals as written, references from the scope, and leaves missing values out", () => {
        expect(
            resolveInput(bindings, { trigger: { message: { text: "hi" } }, steps: { price: { total: 5 } } }),
        ).toEqual({ text: "hi", total: 5, whole: { total: 5 }, tone: "warm", list: [1, 2], none: null })
    })
})
