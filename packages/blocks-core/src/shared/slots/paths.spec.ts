import { textOf, valueAt } from "./paths"

describe("valueAt", () => {
    const record = { name: "Mai", address: { city: "Hue", zip: 49000 } }

    it("returns the record itself for an absent or empty path", () => {
        expect(valueAt(record, undefined)).toBe(record)
        expect(valueAt(record, "")).toBe(record)
    })

    it("follows a dotted path through nested records", () => {
        expect(valueAt(record, "name")).toBe("Mai")
        expect(valueAt(record, "address.city")).toBe("Hue")
    })

    it("is undefined when a step is missing or passes through a value that is not a record", () => {
        expect(valueAt(record, "address.street")).toBeUndefined()
        expect(valueAt(record, "name.first")).toBeUndefined()
        expect(valueAt(null, "name")).toBeUndefined()
    })
})

describe("textOf", () => {
    it("keeps strings and numbers as text and draws anything else as nothing", () => {
        expect(textOf("Mai")).toBe("Mai")
        expect(textOf(42)).toBe("42")
        expect(textOf(true)).toBe("")
        expect(textOf(null)).toBe("")
        expect(textOf({})).toBe("")
    })
})
