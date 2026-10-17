import { Test } from "@nestjs/testing"
import { AUTO_APPLY_TRUST, keyOf, numberOf, sameValue, TRUST } from "./fact-key.policy"

type Subject = {
    keyOf: typeof keyOf
    numberOf: typeof numberOf
    sameValue: typeof sameValue
}

const SUBJECT = Symbol("fact-key.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { keyOf, numberOf, sameValue } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("fact keys", () => {
    afterEach(() => jest.restoreAllMocks())

    it("assigns the exact trust of every source and the direct application threshold", () => {
        expect(TRUST).toEqual({ owner: 95, manager: 85, document: 75, system: 70, staff: 60, customer: 30, ai: 20 })
        expect(AUTO_APPLY_TRUST).toBe(85)
    })

    it("normalizes accents, case and separators, and bounds the key", async () => {
        const subject = await build()

        expect(subject.keyOf("  \u0110\u1ed3ng, COMBO Th\u01b0 gi\u00e3n!!! 12  ")).toBe("dong-combo-thu-gian-12")
        expect(subject.keyOf("???")).toBe("")
        expect(subject.keyOf("A".repeat(130))).toBe("a".repeat(120))
    })

    it.each([
        ["  PRICE 650.000  ", 650000],
        ["650,000", 650000],
        ["1,2 tr", 1200000],
        ["1.5k", 1500],
        ["8tr", 8000000],
        ["2 trieu", 2000000],
        ["2 tri\u1ec7u", 2000000],
        ["1 t\u1ef7", 1000000000],
        ["2 ty", 2000000000],
        ["3 ngh\u00ecn", 3000],
        ["4 nghin", 4000],
        ["5 ng\u00e0n", 5000],
        ["6 ngan", 6000],
        ["-1.2345", -1.23],
        ["1,25", 1.25],
        ["nothing", null],
        ["1.2.3", null],
        ["9".repeat(309), null],
    ])("reads %s as %s", async (text, expected) => {
        const subject = await build()

        expect(subject.numberOf(text)).toBe(expected)
    })

    it("handles an absent number capture defensively", async () => {
        const subject = await build()

        jest.spyOn(String.prototype, "match").mockReturnValueOnce([""])

        expect(subject.numberOf("ignored")).toBe(0)
    })

    it.each([
        ["650.000 VND", "650,000 vnd", true],
        ["8h", "08h", true],
        ["8h", "9h", false],
        ["8h", "8 minutes", false],
        ["Th\u01b0 gi\u00e3n!", "thu gian", true],
        ["eight", "8", false],
        ["8", "eight", false],
        ["first", "second", false],
    ])("compares %s and %s", async (first, second, expected) => {
        const subject = await build()

        expect(subject.sameValue(first, second)).toBe(expected)
    })
})
