import { escapeLike, searchOperand } from "./search-pattern"

describe("escapeLike", () => {
    it("escapes the percent, the underscore and the backslash", () => {
        expect(escapeLike("50%_off\\")).toBe(String.raw`50\%\_off\\`)
    })

    it("leaves plain text alone", () => {
        expect(escapeLike("dinh")).toBe("dinh")
    })
})

describe("searchOperand", () => {
    it("wraps the trimmed escaped text in percent signs", () => {
        expect(searchOperand("  a_b ")).toBe(String.raw`%a\_b%`)
    })

    it("is null when nothing is left", () => {
        expect(searchOperand("   ")).toBeNull()
        expect(searchOperand("")).toBeNull()
    })

    it("cuts the text to 200 characters", () => {
        expect(searchOperand("a".repeat(300))).toBe(`%${"a".repeat(200)}%`)
    })
})
