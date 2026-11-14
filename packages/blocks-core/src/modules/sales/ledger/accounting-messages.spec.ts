import { ACCOUNTING_MESSAGES } from "./accounting-messages"
import { SALES_WORKBENCH_SPEC } from "../specs/sales.workbench"
import { LOYALTY_MESSAGES } from "../loyalty/loyalty-messages"
import { SALES_MESSAGES } from "../sales-messages"

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

    it("holds, with the Sales and loyalty messages, every key the Sales workbench (its ledger and loyalty views included) names", () => {
        const keys = keysIn(SALES_WORKBENCH_SPEC)
        expect(keys.length).toBeGreaterThan(10)
        for (const key of keys)
            expect([key, key in ACCOUNTING_MESSAGES.vi || key in LOYALTY_MESSAGES.vi || key in SALES_MESSAGES.vi]).toEqual([key, true])
    })
})
