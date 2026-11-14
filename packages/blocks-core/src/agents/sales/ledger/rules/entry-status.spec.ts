import { ENTRY_STATUSES, entryStatusOf } from "./entry-status"

describe("entryStatusOf", () => {
    it("gives each kind of entry its status", () => {
        expect(entryStatusOf("income")).toBe("paid")
        expect(entryStatusOf("invoice")).toBe("open")
        expect(entryStatusOf("expense")).toBe("expense")
        expect(entryStatusOf("reversal")).toBe("review")
        expect(entryStatusOf("adjustment")).toBe("review")
    })

    it("lists the four statuses in the order the tabs show them", () => {
        expect(ENTRY_STATUSES).toEqual(["paid", "open", "expense", "review"])
    })
})
