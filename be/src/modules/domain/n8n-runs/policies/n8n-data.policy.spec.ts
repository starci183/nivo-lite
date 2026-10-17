import { Test } from "@nestjs/testing"
import { csvOf, dayOf, dayRange, daysLate, dmy, periodOf, periodRange, vnDay, vnd } from "./n8n-data.policy"

const SUBJECT = Symbol("n8n-data.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { vnd, dmy, vnDay, dayOf, dayRange, periodOf, periodRange, daysLate, csvOf },
            },
        ],
    }).compile()
    return moduleRef.get<{
        vnd: typeof vnd
        dmy: typeof dmy
        vnDay: typeof vnDay
        dayOf: typeof dayOf
        dayRange: typeof dayRange
        periodOf: typeof periodOf
        periodRange: typeof periodRange
        daysLate: typeof daysLate
        csvOf: typeof csvOf
    }>(SUBJECT)
}

describe("vnd", () => {
    it("rounds and writes the thousands separator of Vietnam", async () => {
        const subject = await buildSubject()

        expect(subject.vnd(1234567.6).replace(/\s/gu, " ")).toBe("1.234.568 ₫")
    })
})

describe("dmy and vnDay", () => {
    it("writes a date as dd/mm/yyyy in Vietnam time", async () => {
        const subject = await buildSubject()

        expect(subject.dmy("2026-10-12T20:00:00Z")).toBe("13/10/2026")
        expect(subject.dmy(new Date("2026-10-12T10:00:00Z"))).toBe("12/10/2026")
    })

    it("answers the Vietnam calendar day of an instant", async () => {
        const subject = await buildSubject()

        expect(subject.vnDay(new Date("2026-10-12T20:00:00Z"))).toBe("2026-10-13")
    })
})

describe("dayOf and dayRange", () => {
    const now = new Date("2026-10-12T10:00:00Z")

    it("takes a well-formed day and falls back on today", async () => {
        const subject = await buildSubject()

        expect(subject.dayOf("2026-09-01", now)).toBe("2026-09-01")
        expect(subject.dayOf("1/9", now)).toBe("2026-10-12")
        expect(subject.dayOf(null, now)).toBe("2026-10-12")
        expect(subject.dayOf(undefined, now)).toBe("2026-10-12")
    })

    it("spans the Vietnam day", async () => {
        const subject = await buildSubject()

        expect(subject.dayRange("2026-10-12")).toEqual({
            from: "2026-10-11T17:00:00.000Z",
            to: "2026-10-12T17:00:00.000Z",
        })
    })
})

describe("periodOf and periodRange", () => {
    const now = new Date("2026-01-15T10:00:00Z")

    it("takes a well-formed month and falls back on last month", async () => {
        const subject = await buildSubject()

        expect(subject.periodOf("2026-03", now)).toBe("2026-03")
        expect(subject.periodOf("2026-13", now)).toBe("2025-12")
        expect(subject.periodOf(null, now)).toBe("2025-12")
        expect(subject.periodOf(undefined, now)).toBe("2025-12")
    })

    it("spans a month with its label", async () => {
        const subject = await buildSubject()

        expect(subject.periodRange("2026-03")).toEqual({
            from: "2026-02-28T17:00:00.000Z",
            to: "2026-03-31T17:00:00.000Z",
            label: "03/2026",
        })
    })

    it("rolls December over into the next year", async () => {
        const subject = await buildSubject()

        expect(subject.periodRange("2025-12")).toMatchObject({ to: "2025-12-31T17:00:00.000Z", label: "12/2025" })
    })
})

describe("daysLate", () => {
    it("counts whole days and never goes below zero", async () => {
        const subject = await buildSubject()

        const now = new Date("2026-10-12T10:00:00Z")

        expect(subject.daysLate("2026-10-09T09:00:00Z", now)).toBe(3)
        expect(subject.daysLate(new Date("2026-10-13T10:00:00Z"), now)).toBe(0)
    })
})

describe("csvOf", () => {
    it("starts with a byte order mark, ends lines with CRLF and quotes the cells that need it", async () => {
        const subject = await buildSubject()

        expect(
            subject.csvOf([
                ["a", "b,c"],
                ['say "hi"', 3, null],
                ["line\nbreak", ""],
            ]),
        ).toBe('﻿a,"b,c"\r\n"say ""hi""",3,\r\n"line\nbreak",\r\n')
    })
})
