import { figureTextOf, FIGURE_FORMATS } from "./figure-format"

const EN = { locale: "en", currency: "USD" }
const VI = { locale: "vi", currency: "VND" }

describe("figureTextOf", () => {
    it("lists the four formats", () => {
        expect(FIGURE_FORMATS).toEqual(["number", "money", "percent", "count"])
    })

    it("draws a value with no format as text", () => {
        expect(figureTextOf("12 open", undefined, EN)).toBe("12 open")
        expect(figureTextOf(7, undefined, EN)).toBe("7")
        expect(figureTextOf({}, undefined, EN)).toBe("")
    })

    it("draws a number and money as the cells do, in the language and currency of the context", () => {
        expect(figureTextOf(1234.5, "number", EN)).toBe("1,234.5")
        expect(figureTextOf(1500, "money", EN)).toBe("$1,500.00")
        expect(figureTextOf(150000, "money", VI)).toContain("150.000")
    })

    it("draws a fraction as a percent with one fraction digit at most", () => {
        expect(figureTextOf(0.25, "percent", EN)).toBe("25%")
        expect(figureTextOf("0.1234", "percent", EN)).toBe("12.3%")
    })

    it("draws a count as a whole number with grouping", () => {
        expect(figureTextOf(12345.6, "count", EN)).toBe("12,346")
        expect(figureTextOf("7", "count", EN)).toBe("7")
    })

    it("draws nothing for a value that does not fit its format", () => {
        expect(figureTextOf("n/a", "percent", EN)).toBe("")
        expect(figureTextOf(null, "count", EN)).toBe("")
        expect(figureTextOf(undefined, "money", EN)).toBe("")
    })
})
