import { cellContextOf, cellTextOf, CELL_FORMATS, DEFAULT_CURRENCY, formatValue, numberOf } from "./cell-format"

const EN = { locale: "en", currency: "USD", timeZone: "UTC" }
const VI = { locale: "vi", currency: "VND", timeZone: "UTC" }

/** Newer ICU data separates the time from its marker with a narrow space; the spec compares plain spaces. */
const plain = (text: string): string => text.replace(/\s/gu, " ")

describe("numberOf", () => {
    it("reads a finite number and numeric text", () => {
        expect(numberOf(12)).toBe(12)
        expect(numberOf("12.5")).toBe(12.5)
        expect(numberOf(" 7 ")).toBe(7)
    })

    it("is null for anything else", () => {
        expect(numberOf(Number.NaN)).toBeNull()
        expect(numberOf(Number.POSITIVE_INFINITY)).toBeNull()
        expect(numberOf("")).toBeNull()
        expect(numberOf("  ")).toBeNull()
        expect(numberOf("twelve")).toBeNull()
        expect(numberOf(null)).toBeNull()
        expect(numberOf(true)).toBeNull()
    })
})

describe("formatValue", () => {
    it("lists the six formats", () => {
        expect(CELL_FORMATS).toEqual(["text", "number", "money", "date", "day", "dateTime", "badge"])
    })

    it("draws text and a badge as the text of the value", () => {
        expect(formatValue("Open", "text", EN)).toBe("Open")
        expect(formatValue("Open", "badge", EN)).toBe("Open")
        expect(formatValue(5, undefined, EN)).toBe("5")
        expect(formatValue({}, "text", EN)).toBe("")
    })

    it("draws a number with the grouping of the language", () => {
        expect(formatValue(1234567.5, "number", EN)).toBe("1,234,567.5")
        expect(formatValue("1234", "number", EN)).toBe("1,234")
        expect(formatValue("n/a", "number", EN)).toBe("")
    })

    it("draws money in the currency of the context", () => {
        expect(formatValue(1500, "money", EN)).toBe("$1,500.00")
        expect(formatValue(150000, "money", VI)).toContain("150.000")
        expect(formatValue(null, "money", EN)).toBe("")
    })

    it("draws a day without shifting it by a zone", () => {
        const west = { locale: "en", currency: "USD", timeZone: "America/Los_Angeles" }
        expect(formatValue("2026-11-05", "date", west)).toBe("Nov 5, 2026")
        expect(formatValue("2026-11-05", "date", { locale: "en", currency: "USD" })).toBe("Nov 5, 2026")
    })

    it("draws a moment in the zone of the context, or in the viewer's own when it has none", () => {
        expect(plain(formatValue("2026-11-05T14:30:00Z", "dateTime", EN))).toBe("Nov 5, 2026, 2:30 PM")
        expect(plain(formatValue(Date.UTC(2026, 10, 5, 14, 30), "dateTime", EN))).toBe("Nov 5, 2026, 2:30 PM")
        expect(formatValue("2026-11-05T14:30:00Z", "date", EN)).toBe("Nov 5, 2026")
        expect(formatValue("2026-11-05T14:30:00Z", "dateTime", { locale: "en", currency: "USD" })).not.toBe("")
    })

    it("draws the day and month only, in the order of the language", () => {
        expect(formatValue("2026-11-03", "day", { locale: "vi", currency: "VND" })).toBe("03/11")
        expect(formatValue("2026-11-03", "day", { locale: "en", currency: "USD" })).toBe("11/03")
        expect(formatValue("nope", "day", EN)).toBe("")
    })

    it("draws nothing for a value that is no date", () => {
        expect(formatValue("soon", "date", EN)).toBe("")
        expect(formatValue(null, "dateTime", EN)).toBe("")
        expect(formatValue(true, "date", EN)).toBe("")
    })
})

describe("cellContextOf", () => {
    it("takes the currency of the spec, or the default one", () => {
        expect(cellContextOf("vi", "USD")).toEqual({ locale: "vi", currency: "USD" })
        expect(cellContextOf("en", undefined)).toEqual({ locale: "en", currency: DEFAULT_CURRENCY })
        expect(DEFAULT_CURRENCY).toBe("VND")
    })
})

describe("cellTextOf", () => {
    const label = (path: string, raw: string): string => `${path}:${raw}`
    const labelled = { ...EN, label }

    it("gives a text, badge or unformatted value the words of its path", () => {
        expect(cellTextOf("won", "badge", "stage", labelled)).toBe("stage:won")
        expect(cellTextOf("won", "text", "stage", labelled)).toBe("stage:won")
        expect(cellTextOf("won", undefined, "stage", labelled)).toBe("stage:won")
    })

    it("draws other formats as formatValue does, and a value as it is without labels", () => {
        expect(cellTextOf(1500, "money", "total", labelled)).toBe("$1,500.00")
        expect(cellTextOf("won", "badge", "stage", EN)).toBe("won")
    })
})

describe("cellContextOf with labels", () => {
    it("carries the relabel of the block", () => {
        const label = (_path: string, raw: string): string => raw
        expect(cellContextOf("en", "USD", label)).toEqual({ locale: "en", currency: "USD", label })
    })
})
