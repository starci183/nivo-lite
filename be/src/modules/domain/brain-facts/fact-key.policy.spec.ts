import { Test } from "@nestjs/testing"
import { AUTO_APPLY_TRUST, factSlugOf, numberOf, numbersOf, sameValue, TRUST } from "./fact-key.policy"

type Subject = {
    factSlugOf: typeof factSlugOf
    numberOf: typeof numberOf
    sameValue: typeof sameValue
}

const SUBJECT = Symbol("fact-key.policy")

/** A successful match with an empty whole match and no number capture. */
const emptyMatch = (input: string): RegExpExecArray => {
    const captures: [string] = [""]
    return Object.assign(captures, { index: 0, input })
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { factSlugOf, numberOf, sameValue } }],
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

        expect(subject.factSlugOf("  \u0110\u1ed3ng, COMBO Th\u01b0 gi\u00e3n!!! 12  ")).toBe("dong-combo-thu-gian-12")
        expect(subject.factSlugOf("???")).toBe("")
        expect(subject.factSlugOf("A".repeat(130))).toBe("a".repeat(120))
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

        const nativeExec = RegExp.prototype.exec
        const exec = jest.spyOn(RegExp.prototype, "exec").mockImplementation(function (this: RegExp, text: string) {
            return this.source.startsWith("(-?") ? emptyMatch(text) : nativeExec.call(this, text)
        })

        try {
            expect(subject.numberOf("ignored")).toBe(0)
        } finally {
            exec.mockRestore()
        }
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
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "5.000 \u20ab", true],
        ["5.000 \u20ab/ch\u1eadu", "5.000 \u0111", true],
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "5000 VND", true],
        ["5k m\u1ed7i ly", "5.000 \u0111", true],
        ["5k moi ly", "5.000 \u0111", true],
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "6.000 \u20ab", false],
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "6.000 \u20ab m\u1ed9t ch\u1eadu", false],
        ["5 tr\u1ee9ng", "5 tri\u1ec7u", false],
        ["5 ph\u00fat", "5 gi\u1edd", false],
    ])("compares %s and %s", async (first, second, expected) => {
        const subject = await build()

        expect(subject.sameValue(first, second)).toBe(expected)
    })
})

describe("fact keys numbersOf (BG2)", () => {
    it.each([
        ["B\u00f3 hoa h\u1ed3ng \u0111\u1ecf 10 b\u00f4ng: 350.000 \u0111", [10, 350000]],
        ["350k", [350000]],
        ["1,2 tri\u1ec7u", [1200000]],
        ["8:00-20:00", [8, 0, 20, 0]],
        ["16/02/2026", [16, 2, 2026]],
        ["10 km", [10]],
        ["kh\u00f4ng nh\u1eadn \u0111\u01a1n", []],
    ])("reads every number of %s", (text, expected) => {
        expect(numbersOf(text)).toEqual(expected)
    })
})
