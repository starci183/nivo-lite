import { fold, normalisePhone, parseDateLoose, parseNumberLoose } from "./csv-import-values.policy"

describe("fold", () => {
    it("turns a Vietnamese heading into plain words", () => {
        expect(fold("S\u1ed1 \u0111i\u1ec7n tho\u1ea1i!")).toBe("so dien thoai")
    })
})

describe("normalisePhone", () => {
    it.each([
        ["+84 912 345 678", "0912345678"],
        ["912345678", "0912345678"],
        ["0912345678", "0912345678"],
        ["84912345678", "0912345678"],
        ["84", "84"],
        ["012345678", "012345678"],
        ["abc", ""],
    ])("reads %s as %s", (raw, digits) => {
        expect(normalisePhone(raw)).toBe(digits)
    })
})

describe("parseNumberLoose", () => {
    it.each([
        ["1.200.000", 1_200_000],
        ["1,200,000", 1_200_000],
        ["1.234,56", 1234.56],
        ["1,234.56", 1234.56],
        ["12.5", 12.5],
        ["1.200", 1200],
        ["0.200", 0.2],
        ["12,50", 12.5],
        ["(300)", -300],
        ["(-300)", 300],
        ["-1,5", -1.5],
        ["+300", 300],
        ["1 200 \u0111", 1200],
        ["$12", 12],
        ["10%", 10],
        ["1234.567", 1234.567],
        ["1.2.3", 123],
    ])("reads %s as %s", (raw, value) => {
        expect(parseNumberLoose(raw)).toBe(value)
    })

    it.each(["", "  ", "abc", ".", "1.", "+(300)"])("rejects %s", (raw) => {
        expect(parseNumberLoose(raw)).toBeNull()
    })

    it("rejects a magnitude that is not finite", () => {
        expect(parseNumberLoose("9".repeat(400))).toBeNull()
    })

    it("strips a dollar sign after the amount", () => {
        expect(parseNumberLoose("12$")).toBe(12)
    })
})

describe("parseDateLoose", () => {
    it("reads a date-only value as midnight in Vietnam", () => {
        expect(parseDateLoose("2026-10-14")).toBe("2026-10-13T17:00:00.000Z")
        expect(parseDateLoose("2026/1/2")).toBe("2026-01-01T17:00:00.000Z")
        expect(parseDateLoose("14/10/2026")).toBe("2026-10-13T17:00:00.000Z")
        expect(parseDateLoose("14-10-26")).toBe("2026-10-13T17:00:00.000Z")
        expect(parseDateLoose("14.10.69")).toBe("2069-10-13T17:00:00.000Z")
        expect(parseDateLoose("14.10.70")).toBe("1970-10-13T17:00:00.000Z")
    })

    it("reads a time and a zone", () => {
        expect(parseDateLoose("2026-10-14T09:30:05.123+07:00")).toBe("2026-10-14T02:30:05.000Z")
        expect(parseDateLoose("2026-10-14 9:05")).toBe("2026-10-14T02:05:00.000Z")
        expect(parseDateLoose("14/10/2026 09:05")).toBe("2026-10-14T02:05:00.000Z")
        expect(parseDateLoose("2026-10-14T09:30Z")).toBe("2026-10-14T09:30:00.000Z")
        expect(parseDateLoose("2026-10-14T09:30+0700")).toBe("2026-10-14T02:30:00.000Z")
    })

    it.each([
        "",
        "nope",
        "2026-00-01",
        "2026-13-01",
        "2026-01-00",
        "2026-01-32",
        "1899-01-01",
        "2201-01-01",
        "2026-02-31",
        "2026-10-14Tnoon",
        "2026-10-14T25:00",
        "2026-10-14T09:60",
        "2026-10-14T09:30+99:99",
    ])("rejects %s", (raw) => {
        expect(parseDateLoose(raw)).toBeNull()
    })

    it("drops fractional seconds with the current time parser", () => {
        expect(parseDateLoose("2026-10-14T09:30:05.123+07:00")).toBe("2026-10-14T02:30:05.000Z")
    })

    it("reads minute precision with an implicit or compact zone", () => {
        expect(parseDateLoose("2026-10-14 9:05")).toBe("2026-10-14T02:05:00.000Z")
        expect(parseDateLoose("14/10/2026 09:05")).toBe("2026-10-14T02:05:00.000Z")
        expect(parseDateLoose("2026-10-14T09:30Z")).toBe("2026-10-14T09:30:00.000Z")
        expect(parseDateLoose("2026-10-14T09:30+0700")).toBe("2026-10-14T02:30:00.000Z")
    })

    it("structurally rejects a local date match with no year capture", () => {
        // A native successful local match always has a year; simulate a malformed intermediate explicitly.
        const raw = "14/10/2026"
        const captures: [string, string, string] = [raw, "14", "10"]
        const malformed: RegExpExecArray = Object.assign(captures, { index: 0, input: raw })
        const exec = jest.spyOn(RegExp.prototype, "exec").mockReturnValueOnce(null).mockReturnValueOnce(malformed)
        try {
            expect(parseDateLoose(raw)).toBeNull()
        } finally {
            exec.mockRestore()
        }
    })
})
