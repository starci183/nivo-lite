import { Test } from "@nestjs/testing"
import {
    AUTO_APPLY_TRUST,
    factSlugOf,
    numberOf,
    numbersOf,
    sameValue,
    TRUST,
    valueFormOf,
    readByJudge,
    valueTypeProblemOf,
} from "./fact-key.policy"

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
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "5.000 \u20ab", false],
        ["5.000 \u20ab/ch\u1eadu", "5.000 \u0111", false],
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "5000 VND", false],
        ["5k m\u1ed7i ly", "5.000 \u0111", false],
        ["5k moi ly", "5.000 \u0111", false],
        ["5.000 \u20ab m\u1ed9t ch\u1eadu", "5000 VND m\u1ed9t ch\u1eadu", true],
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

describe("fact keys: the ONE normal form values are compared in (D-BR-10, the walk's 49 false conflicts)", () => {
    it.each([
        // Money written four ways (P01 / I05 / I07 lines of the walk).
        ["30.000 \u0111", "30k", true],
        ["30.000 \u0111", "30 ngh\u00ecn", true],
        ["30.000 \u0111", "30,000 VND", true],
        ["30k m\u1ed9t \u0111\u01a1n", "30.000 \u0111 m\u1ed7i \u0111\u01a1n", false],
        ["30k", "35.000 \u0111", false],
        // Shares.
        ["5 ph\u1ea7n tr\u0103m", "5 %", true],
        ["5%", "5 phan tram", true],
        ["5%", "6%", false],
        // Spans of the clock.
        ["8:00\u201320:00", "8h \u0111\u1ebfn 20h", true],
        ["8h00 - 20h30", "t\u1eeb 8 gi\u1edd \u0111\u1ebfn 20 gi\u1edd 30", true],
        ["8:00\u201320:00", "8:00\u201320:30", false],
        // Yes / no.
        ["C\u00f3", "c\u00f3", true],
        ["Kh\u00f4ng", "khong", true],
        ["C\u00f3", "Kh\u00f4ng", false],
        // Lengths of time.
        ["24 gi\u1edd", "1 ng\u00e0y", true],
        // A range of counts is not a span of the clock.
        ["10-20 b\u00f4ng", "10:00-20:00", false],
    ])("compares %s and %s as %s", (first, second, expected) => {
        expect(sameValue(first, second)).toBe(expected)
    })

    it.each([
        ["30.000 \u0111", { type: "money", key: "30000" }],
        ["mi\u1ec5n ph\u00ed", { type: "money", key: "0" }],
        ["30k m\u1ed9t \u0111\u01a1n", { type: "money", key: "30000:mot-don", worded: true }],
        ["30000", { type: "number", key: "30000" }],
        ["5 %", { type: "percent", key: "5" }],
        ["8h \u0111\u1ebfn 20h", { type: "time_range", key: "08:00-20:00" }],
        ["2 ti\u1ebfng", { type: "duration", key: "120" }],
        ["C\u00f3", { type: "boolean", key: "yes" }],
        ["57 V\u00f5 V\u0103n Ng\u00e2n", { type: "text", key: "57-vo-van-ngan" }],
    ])("reads %s as %j", (value, form) => {
        expect(valueFormOf(value)).toEqual(form)
    })
})

describe("fact keys: a typed truth takes only a value of its type (D-BR-12)", () => {
    const labels = "Giao h\u00e0ng Chi nh\u00e1nh 1 - C\u1ea7n Gi\u1edd giao"

    it("reads the type from the value alone: a yes or no is a yes/no rule only when it is the whole value (no word is read against the labels)", () => {
        expect(valueFormOf("kh\u00f4ng giao").type).toBe("text")
        expect(valueFormOf("Kh\u00f4ng").type).toBe("boolean")
    })

    it("hands to the judge what code cannot compare beyond exact equality: free text and an amount with other words", () => {
        expect(readByJudge("30k m\u1ed9t \u0111\u01a1n")).toBe(true)
        expect(readByJudge("57 V\u00f5 V\u0103n Ng\u00e2n")).toBe(true)
        expect(readByJudge("30.000 \u0111")).toBe(false)
        expect(readByJudge("5%")).toBe(false)
    })

    it.each([
        // The walk's A18: "maybe" on "Giao hang Chi nhanh 1 - Can Gio = khong giao" was applied.
        [{ value: "Kh\u00f4ng", labels }, { value: "maybe", labels }, "not_boolean"],
        // A value that is words ("no delivery") is text for code: it takes any value; what it means is not read here.
        [{ value: "kh\u00f4ng giao", labels }, { value: "maybe", labels }, null],
        [{ value: "kh\u00f4ng giao", labels }, { value: "C\u00f3", labels }, null],
        [{ value: "30.000 \u0111", labels: "Ph\u00ed giao" }, { value: "abc", labels: "Ph\u00ed giao" }, "not_money"],
        [{ value: "30.000 \u0111", labels: "Ph\u00ed giao" }, { value: "35000", labels: "Ph\u00ed giao" }, null],
        [{ value: "5%", labels: "Gi\u1ea3m" }, { value: "120 \u0111", labels: "Gi\u1ea3m" }, "not_percent"],
        [
            { value: "8:00-20:00", labels: "Gi\u1edd" },
            { value: "c\u1ea3 ng\u00e0y", labels: "Gi\u1edd" },
            "not_time_range",
        ],
        [
            { value: "24 gi\u1edd", labels: "\u0110\u1ed5i" },
            { value: "l\u00e2u", labels: "\u0110\u1ed5i" },
            "not_duration",
        ],
        [
            { value: "57 V\u00f5 V\u0103n Ng\u00e2n", labels: "\u0110\u1ecba ch\u1ec9" },
            { value: "maybe", labels: "\u0110\u1ecba ch\u1ec9" },
            null,
        ],
    ])("replacing %j with %j is %s", (current, next, problem) => {
        expect(valueTypeProblemOf(current, next)).toBe(problem)
    })
})
