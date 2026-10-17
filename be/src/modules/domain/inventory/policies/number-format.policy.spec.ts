import { Test } from "@nestjs/testing"
import { foldText, formatDay, formatMoney, formatQty, parseNumber, columnNumber } from "./number-format.policy"

const SUBJECT = Symbol("number-format.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    parseNumber,
                    columnNumber,
                    formatQty,
                    formatMoney,
                    formatDay,
                    foldText,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./number-format.policy")>(SUBJECT)
}

const DONG = String.fromCodePoint(0x20ab)
const D_STROKE = String.fromCodePoint(0x111)
const A_GRAVE = String.fromCodePoint(0xe0)
const E_CIRCUMFLEX = String.fromCodePoint(0xea)
const U_HORN_TILDE = String.fromCodePoint(0x1eef)

describe("parseNumber", () => {
    it("reads a finite number as it is", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber(12.5)).toBe(12.5)
    })

    it("answers the fallback for a number that is not finite", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber(Number.NaN, 7)).toBe(7)
    })

    it("answers the fallback for a value that is neither a number nor a text", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber(null, 3)).toBe(3)
        expect(subject.parseNumber(undefined)).toBe(0)
    })

    it("reads a decimal written with a comma or a dot", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber("1,5")).toBe(1.5)
        expect(subject.parseNumber("1.5")).toBe(1.5)
    })

    it("reads a dot or comma grouped number as thousands", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber("1.200")).toBe(1200)
        expect(subject.parseNumber("1,200,000")).toBe(1_200_000)
    })

    it("ignores spaces and a trailing currency mark", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber(" 5 000 ")).toBe(5000)
        expect(subject.parseNumber(`2500${DONG}`)).toBe(2500)
        expect(subject.parseNumber(`2500${D_STROKE}`)).toBe(2500)
        expect(subject.parseNumber("2500d")).toBe(2500)
    })

    it("answers the fallback for an empty or unreadable text", async () => {
        const subject = await buildSubject()

        expect(subject.parseNumber("   ", 9)).toBe(9)
        expect(subject.parseNumber("abc", 4)).toBe(4)
    })
})

describe("formatQty", () => {
    it("groups thousands and keeps at most three decimals", async () => {
        const subject = await buildSubject()

        expect(subject.formatQty(1234.5)).toBe("1.234,5")
        expect(subject.formatQty(0.12345)).toBe("0,123")
    })
})

describe("formatMoney", () => {
    it("rounds to whole dong and groups thousands", async () => {
        const subject = await buildSubject()

        expect(subject.formatMoney(1234567.6)).toMatch(/^1\.234\.568\s/u)
    })
})

describe("formatDay", () => {
    it("writes day, month and year from an ISO date or date-time", async () => {
        const subject = await buildSubject()

        expect(subject.formatDay("2026-10-12")).toBe("12/10/2026")
        expect(subject.formatDay("2026-10-12T08:30:00.000Z")).toBe("12/10/2026")
    })
})

describe("foldText", () => {
    it("lowers the case, strips accents and the stroke of d, and keeps letters and digits", async () => {
        const subject = await buildSubject()

        const accented = `C${A_GRAVE} ph${E_CIRCUMFLEX} s${U_HORN_TILDE}a, ${D_STROKE}${D_STROKE}-2`
        expect(subject.foldText(accented)).toBe("ca phe sua dd 2")
    })

    it("answers an empty text for punctuation only", async () => {
        const subject = await buildSubject()

        expect(subject.foldText(" -- ")).toBe("")
    })
})
