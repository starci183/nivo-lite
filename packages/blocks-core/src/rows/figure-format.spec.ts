import {
    chartPointOf,
    figureTextOf,
    FIGURE_FORMATS,
    FIGURE_KINDS,
    FIGURE_VARIANTS,
    isRibbon,
    proportionTotal,
} from "./figure-format"

const EN = { locale: "en", currency: "USD" }
const VI = { locale: "vi", currency: "VND" }

describe("figureTextOf", () => {
    it("lists the five formats (a tally: a count that may be unstated)", () => {
        expect(FIGURE_FORMATS).toEqual(["number", "money", "percent", "count", "tally"])
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

describe("figure charts", () => {
    it("lists the three kinds", () => {
        expect(FIGURE_KINDS).toEqual(["tiles", "bars", "proportion"])
    })

    it("makes a point from a number, from numeric text, and from a value that is no number or is negative", () => {
        expect(chartPointOf("a", "A", 12, "12")).toEqual({ id: "a", label: "A", value: 12, valueLabel: "12" })
        expect(chartPointOf("a", "A", "7", "7").value).toBe(7)
        expect(chartPointOf("a", "A", undefined, "").value).toBe(0)
        expect(chartPointOf("a", "A", -3, "-3").value).toBe(0)
    })

    it("shares one scale: the sum of the items, and one when they are all empty", () => {
        const points = [chartPointOf("a", "A", 2, "2"), chartPointOf("b", "B", 3, "3")]
        expect(proportionTotal(points)).toBe(5)
        expect(proportionTotal([chartPointOf("a", "A", 0, "0")])).toBe(1)
        expect(proportionTotal([])).toBe(1)
    })
})

describe("isRibbon", () => {
    it("draws a ribbon only when asked and when two to five figures fit it", () => {
        expect(FIGURE_VARIANTS).toEqual(["strip", "ribbon"])
        expect(isRibbon("ribbon", 4)).toBe(true)
        expect(isRibbon("ribbon", 2)).toBe(true)
        expect(isRibbon("ribbon", 5)).toBe(true)
        expect(isRibbon("ribbon", 1)).toBe(false)
        expect(isRibbon("ribbon", 6)).toBe(false)
        expect(isRibbon("strip", 4)).toBe(false)
        expect(isRibbon(undefined, 4)).toBe(false)
    })
})
