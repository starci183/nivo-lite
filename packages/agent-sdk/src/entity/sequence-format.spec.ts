import { EntityDefinitionError } from "./entity-error"
import { formatSequence, parseSequenceFormat, sequenceDeclarationValid, sequencePeriodOf } from "./sequence-format"

const DAY = { year: 2026, month: 11, day: 5 }

describe("parseSequenceFormat", () => {
    it("splits a format into literal, date and counter parts", () => {
        expect(parseSequenceFormat("DH-{yyyy}{mm}{dd}-{n:4}")).toEqual([
            { kind: "literal", text: "DH-" },
            { kind: "year" },
            { kind: "month" },
            { kind: "day" },
            { kind: "literal", text: "-" },
            { kind: "counter", width: 4 },
        ])
    })

    it("accepts the counter alone and widths 1 and 12", () => {
        expect(parseSequenceFormat("{n:1}")).toEqual([{ kind: "counter", width: 1 }])
        expect(parseSequenceFormat("{n:12}")).toEqual([{ kind: "counter", width: 12 }])
    })

    it.each([
        ["empty", ""],
        ["no counter", "DH-{yyyy}"],
        ["two counters", "{n:3}-{n:3}"],
        ["width zero", "{n:0}"],
        ["width over 12", "{n:13}"],
        ["width with leading zero", "{n:05}"],
        ["unknown token", "{n:3}{hh}"],
        ["stray open brace", "{n:3}-{"],
        ["stray close brace", "}{n:3}"],
        ["nested braces", "{{n:3}}"],
        ["too long", `${"x".repeat(100)}{n:3}`],
    ])("refuses %s", (_name, format) => {
        expect(parseSequenceFormat(format)).toBeUndefined()
    })
})

describe("sequenceDeclarationValid", () => {
    it("requires a parsable format", () => {
        expect(sequenceDeclarationValid(undefined, undefined)).toBe(false)
        expect(sequenceDeclarationValid("DH", undefined)).toBe(false)
        expect(sequenceDeclarationValid("DH-{n:3}", undefined)).toBe(true)
    })

    it("requires the date parts of the period the counter restarts in", () => {
        expect(sequenceDeclarationValid("DH-{yyyy}{mm}{dd}-{n:4}", "day")).toBe(true)
        expect(sequenceDeclarationValid("DH-{yyyy}{mm}-{n:4}", "day")).toBe(false)
        expect(sequenceDeclarationValid("DH-{yyyy}{mm}-{n:4}", "month")).toBe(true)
        expect(sequenceDeclarationValid("DH-{mm}-{n:4}", "month")).toBe(false)
        expect(sequenceDeclarationValid("DH-{yyyy}-{n:4}", "year")).toBe(true)
        expect(sequenceDeclarationValid("DH-{n:4}", "year")).toBe(false)
    })
})

describe("sequencePeriodOf", () => {
    it("names the period a counter counts in", () => {
        expect(sequencePeriodOf(undefined, DAY)).toBe("")
        expect(sequencePeriodOf("year", DAY)).toBe("2026")
        expect(sequencePeriodOf("month", DAY)).toBe("2026-11")
        expect(sequencePeriodOf("day", DAY)).toBe("2026-11-05")
        expect(sequencePeriodOf("year", { year: 5, month: 1, day: 1 })).toBe("0005")
    })
})

describe("formatSequence", () => {
    it("pads the counter and writes the date parts the caller zoned", () => {
        expect(formatSequence("DH-{yyyy}{mm}{dd}-{n:4}", 42, DAY)).toBe("DH-20261105-0042")
        expect(formatSequence("{yyyy}/{mm}/{n:2}", 7, { year: 2026, month: 1, day: 31 })).toBe("2026/01/07")
    })

    it("never truncates a counter wider than its width", () => {
        expect(formatSequence("{n:2}", 12345, DAY)).toBe("12345")
    })

    it("pads a year below 1000 to four digits", () => {
        expect(formatSequence("{yyyy}-{n:1}", 0, { year: 999, month: 6, day: 15 })).toBe("0999-0")
    })

    it("refuses an invalid format or counter", () => {
        expect(() => formatSequence("DH", 1, DAY)).toThrow(EntityDefinitionError)
        expect(() => formatSequence("{n:3}", -1, DAY)).toThrow("ENTITY_SEQUENCE_VALUE_INVALID: n=-1")
        expect(() => formatSequence("{n:3}", 1.5, DAY)).toThrow(EntityDefinitionError)
    })

    it.each([
        ["year below 0", { year: -1, month: 1, day: 1 }],
        ["year above 9999", { year: 10000, month: 1, day: 1 }],
        ["fractional year", { year: 2026.5, month: 1, day: 1 }],
        ["month 0", { year: 2026, month: 0, day: 1 }],
        ["month 13", { year: 2026, month: 13, day: 1 }],
        ["fractional month", { year: 2026, month: 1.5, day: 1 }],
        ["day 0", { year: 2026, month: 1, day: 0 }],
        ["day 32", { year: 2026, month: 1, day: 32 }],
        ["fractional day", { year: 2026, month: 1, day: 1.5 }],
    ])("refuses a date with %s", (_name, date) => {
        expect(() => formatSequence("{n:3}", 1, date)).toThrow("ENTITY_SEQUENCE_VALUE_INVALID: date")
    })
})
