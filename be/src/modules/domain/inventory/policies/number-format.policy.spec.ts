import { foldText, formatDay, formatMoney, formatQty, parseNumber } from "./number-format.policy"

const DONG = String.fromCodePoint(0x20ab)
const D_STROKE = String.fromCodePoint(0x111)
const A_GRAVE = String.fromCodePoint(0xe0)
const E_CIRCUMFLEX = String.fromCodePoint(0xea)
const U_HORN_TILDE = String.fromCodePoint(0x1eef)

describe("parseNumber", () => {
    it("reads a finite number as it is", () => {
        expect(parseNumber(12.5)).toBe(12.5)
    })

    it("answers the fallback for a number that is not finite", () => {
        expect(parseNumber(Number.NaN, 7)).toBe(7)
    })

    it("answers the fallback for a value that is neither a number nor a text", () => {
        expect(parseNumber(null, 3)).toBe(3)
        expect(parseNumber(undefined)).toBe(0)
    })

    it("reads a decimal written with a comma or a dot", () => {
        expect(parseNumber("1,5")).toBe(1.5)
        expect(parseNumber("1.5")).toBe(1.5)
    })

    it("reads a dot or comma grouped number as thousands", () => {
        expect(parseNumber("1.200")).toBe(1200)
        expect(parseNumber("1,200,000")).toBe(1_200_000)
    })

    it("ignores spaces and a trailing currency mark", () => {
        expect(parseNumber(" 5 000 ")).toBe(5000)
        expect(parseNumber(`2500${DONG}`)).toBe(2500)
        expect(parseNumber(`2500${D_STROKE}`)).toBe(2500)
        expect(parseNumber("2500d")).toBe(2500)
    })

    it("answers the fallback for an empty or unreadable text", () => {
        expect(parseNumber("   ", 9)).toBe(9)
        expect(parseNumber("abc", 4)).toBe(4)
    })
})

describe("formatQty", () => {
    it("groups thousands and keeps at most three decimals", () => {
        expect(formatQty(1234.5)).toBe("1.234,5")
        expect(formatQty(0.12345)).toBe("0,123")
    })
})

describe("formatMoney", () => {
    it("rounds to whole dong and groups thousands", () => {
        expect(formatMoney(1234567.6)).toMatch(/^1\.234\.568\s/u)
    })
})

describe("formatDay", () => {
    it("writes day, month and year from an ISO date or date-time", () => {
        expect(formatDay("2026-10-12")).toBe("12/10/2026")
        expect(formatDay("2026-10-12T08:30:00.000Z")).toBe("12/10/2026")
    })
})

describe("foldText", () => {
    it("lowers the case, strips accents and the stroke of d, and keeps letters and digits", () => {
        const accented = `C${A_GRAVE} ph${E_CIRCUMFLEX} s${U_HORN_TILDE}a, ${D_STROKE}${D_STROKE}-2`
        expect(foldText(accented)).toBe("ca phe sua dd 2")
    })

    it("answers an empty text for punctuation only", () => {
        expect(foldText(" -- ")).toBe("")
    })
})
