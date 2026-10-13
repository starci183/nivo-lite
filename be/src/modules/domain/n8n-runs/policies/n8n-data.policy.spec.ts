import { csvOf, dayOf, dayRange, daysLate, dmy, periodOf, periodRange, vnDay, vnd } from "./n8n-data.policy"

describe("vnd", () => {
    it("rounds and writes the thousands separator of Vietnam", () => {
        expect(vnd(1234567.6).replace(/\s/gu, " ")).toBe("1.234.568 ₫")
    })
})

describe("dmy and vnDay", () => {
    it("writes a date as dd/mm/yyyy in Vietnam time", () => {
        expect(dmy("2026-10-12T20:00:00Z")).toBe("13/10/2026")
        expect(dmy(new Date("2026-10-12T10:00:00Z"))).toBe("12/10/2026")
    })

    it("answers the Vietnam calendar day of an instant", () => {
        expect(vnDay(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-13")
    })
})

describe("dayOf and dayRange", () => {
    const now = new Date("2026-10-12T10:00:00Z")

    it("takes a well-formed day and falls back on today", () => {
        expect(dayOf("2026-09-01", now)).toBe("2026-09-01")
        expect(dayOf("1/9", now)).toBe("2026-10-12")
        expect(dayOf(null, now)).toBe("2026-10-12")
        expect(dayOf(undefined, now)).toBe("2026-10-12")
    })

    it("spans the Vietnam day", () => {
        expect(dayRange("2026-10-12")).toEqual({ from: "2026-10-11T17:00:00.000Z", to: "2026-10-12T17:00:00.000Z" })
    })
})

describe("periodOf and periodRange", () => {
    const now = new Date("2026-01-15T10:00:00Z")

    it("takes a well-formed month and falls back on last month", () => {
        expect(periodOf("2026-03", now)).toBe("2026-03")
        expect(periodOf("2026-13", now)).toBe("2025-12")
        expect(periodOf(null, now)).toBe("2025-12")
        expect(periodOf(undefined, now)).toBe("2025-12")
    })

    it("spans a month with its label", () => {
        expect(periodRange("2026-03")).toEqual({
            from: "2026-02-28T17:00:00.000Z",
            to: "2026-03-31T17:00:00.000Z",
            label: "03/2026",
        })
    })

    it("rolls December over into the next year", () => {
        expect(periodRange("2025-12")).toMatchObject({ to: "2025-12-31T17:00:00.000Z", label: "12/2025" })
    })
})

describe("daysLate", () => {
    it("counts whole days and never goes below zero", () => {
        const now = new Date("2026-10-12T10:00:00Z")

        expect(daysLate("2026-10-09T09:00:00Z", now)).toBe(3)
        expect(daysLate(new Date("2026-10-13T10:00:00Z"), now)).toBe(0)
    })
})

describe("csvOf", () => {
    it("starts with a byte order mark, ends lines with CRLF and quotes the cells that need it", () => {
        expect(
            csvOf([
                ["a", "b,c"],
                ['say "hi"', 3, null],
                ["line\nbreak", ""],
            ]),
        ).toBe('﻿a,"b,c"\r\n"say ""hi""",3,\r\n"line\nbreak",\r\n')
    })
})
