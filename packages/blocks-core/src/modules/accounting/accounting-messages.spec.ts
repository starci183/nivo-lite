import { ACCOUNTING_MESSAGES } from "./accounting-messages"
import { accountingSpecDocument } from "./specs/accounting.spec-document"

/** The message keys a spec text names, wherever they sit in the document. */
const keysIn = (value: unknown): ReadonlyArray<string> => {
    if (Array.isArray(value)) return value.flatMap(keysIn)
    if (typeof value !== "object" || value === null) return []
    return Object.entries(value).flatMap(([name, member]) => (name === "key" ? [String(member)] : keysIn(member)))
}

describe("accounting messages", () => {
    it("has the same keys in both product languages", () => {
        expect(Object.keys(ACCOUNTING_MESSAGES.vi).sort()).toEqual(Object.keys(ACCOUNTING_MESSAGES.en).sort())
    })

    it("holds every key the seed spec names", () => {
        const keys = keysIn(accountingSpecDocument)
        expect(keys.length).toBeGreaterThan(10)
        for (const key of keys) expect([key, key in ACCOUNTING_MESSAGES.vi]).toEqual([key, true])
    })
})
