import { pendingQuery, queryOf, SEARCH_DEBOUNCE_MS, SEARCH_MAX } from "./search"

describe("queryOf", () => {
    it("trims the text and keeps what is left", () => {
        expect(queryOf("  nguyen an  ")).toBe("nguyen an")
    })

    it("is null when nothing is typed or only blanks", () => {
        expect(queryOf("")).toBeNull()
        expect(queryOf("   ")).toBeNull()
        expect(queryOf(null)).toBeNull()
    })

    it("cuts a long paste at the bound and trims the cut", () => {
        const pasted = `${"a".repeat(SEARCH_MAX - 1)} ${"b".repeat(10)}`
        expect(queryOf(pasted)).toBe("a".repeat(SEARCH_MAX - 1))
    })
})

describe("pendingQuery", () => {
    it("says nothing to write when the param already holds the text", () => {
        expect(pendingQuery("an", "an")).toBeNull()
        expect(pendingQuery(" an ", "an")).toBeNull()
        expect(pendingQuery("", null)).toBeNull()
        expect(pendingQuery("  ", null)).toBeNull()
    })

    it("writes the trimmed text when it differs from the param", () => {
        expect(pendingQuery(" binh ", "an")).toEqual({ value: "binh" })
        expect(pendingQuery("an", null)).toEqual({ value: "an" })
    })

    it("clears the param when the field was emptied", () => {
        expect(pendingQuery("", "an")).toEqual({ value: null })
    })
})

describe("SEARCH_DEBOUNCE_MS", () => {
    it("waits 300 ms", () => {
        expect(SEARCH_DEBOUNCE_MS).toBe(300)
    })
})
