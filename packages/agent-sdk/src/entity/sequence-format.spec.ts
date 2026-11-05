import { EntityDefinitionError } from "./entity-error"
import { formatSequence, parseSequenceFormat } from "./sequence-format"

describe("parseSequenceFormat", () => {
    it("splits a format into literal, date and counter parts", () => {
        expect(parseSequenceFormat("DH-{yyyy}{mm}-{n:5}")).toEqual([
            { kind: "literal", text: "DH-" },
            { kind: "year" },
            { kind: "month" },
            { kind: "literal", text: "-" },
            { kind: "counter", width: 5 },
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
        ["unknown token", "{n:3}{dd}"],
        ["stray open brace", "{n:3}-{"],
        ["stray close brace", "}{n:3}"],
        ["nested braces", "{{n:3}}"],
        ["too long", `${"x".repeat(100)}{n:3}`],
    ])("refuses %s", (_name, format) => {
        expect(parseSequenceFormat(format)).toBeUndefined()
    })
})

describe("formatSequence", () => {
    const created = new Date("2026-11-05T10:00:00Z")

    it("pads the counter and reads the date in UTC", () => {
        expect(formatSequence("DH-{yyyy}-{n:5}", 42, created)).toBe("DH-2026-00042")
        expect(formatSequence("{yyyy}{mm}/{n:2}", 7, new Date("2026-01-31T23:59:59Z"))).toBe("202601/07")
    })

    it("never truncates a counter wider than its width", () => {
        expect(formatSequence("{n:2}", 12345, created)).toBe("12345")
    })

    it("pads a year below 1000 to four digits", () => {
        expect(formatSequence("{yyyy}-{n:1}", 0, new Date("0999-06-15T00:00:00Z"))).toBe("0999-0")
    })

    it("refuses an invalid format, counter or date", () => {
        expect(() => formatSequence("DH", 1, created)).toThrow(EntityDefinitionError)
        expect(() => formatSequence("{n:3}", -1, created)).toThrow("ENTITY_SEQUENCE_VALUE_INVALID: n=-1")
        expect(() => formatSequence("{n:3}", 1.5, created)).toThrow(EntityDefinitionError)
        expect(() => formatSequence("{n:3}", 1, new Date("nope"))).toThrow("ENTITY_SEQUENCE_VALUE_INVALID: createdAt")
    })
})
