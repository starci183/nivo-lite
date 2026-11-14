import { Test } from "@nestjs/testing"
import {
    SYSTEM_PROMPT,
    calendarDayOf,
    dateLinesOf,
    datedFactOf,
    documentDatePrompt,
    followUpOf,
    parseDocumentDate,
    parseFacts,
    relativeDayOf,
    resolvedDayOf,
    resolvedPeriodOf,
} from "./extraction.policy"
import type { CalendarDay, ReadPassage } from "./extraction.policy"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

const SUBJECT = Symbol("extraction.policy")

/** The policy's own functions, provided through a testing module the way Nest builds a subject. */
const build = async (): Promise<typeof import("./extraction.policy")> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    calendarDayOf,
                    dateLinesOf,
                    datedFactOf,
                    documentDatePrompt,
                    followUpOf,
                    parseDocumentDate,
                    parseFacts,
                    relativeDayOf,
                    resolvedDayOf,
                    resolvedPeriodOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./extraction.policy")>(SUBJECT)
}

/** A calendar day from its text, for the arithmetic cases. */
const day = (text: string): CalendarDay => {
    const parsed = calendarDayOf(text)
    if (parsed === null) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: `not a day: ${text}` } })
    return parsed
}

/** The day a resolved day writes, or null. */
const textOf = (resolved: CalendarDay | null): string | null =>
    resolved === null
        ? null
        : `${String(resolved.year)}-${String(resolved.month).padStart(2, "0")}-${String(resolved.day).padStart(2, "0")}`

// A synthetic bicycle workshop: a standing fee and a time-boxed one.
const FEES: ReadPassage = {
    id: "bf",
    hash: "hb",
    text: ["Tyre change: 60,000 VND.", "From 2026-12-01 to 2026-12-07 the tyre change is 45,000 VND.", "Brake tune-up costs 80,000 VND for the next 14 days."].join(
        "\n",
    ),
}

describe("extraction.policy: a period that cannot be read never drops the truth: kept without it, flagged, told once (version 10, D2)", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("reads only strict days the calendar has", () => {
        expect(subject.calendarDayOf("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 })
        expect(subject.calendarDayOf("2026-02-29")).toBeNull()
        expect(subject.calendarDayOf("2026-02-30")).toBeNull()
        expect(subject.calendarDayOf("2026-04-31")).toBeNull()
        expect(subject.calendarDayOf("2026-12-01T00:00")).toBeNull()
        expect(subject.calendarDayOf("01/12/2026")).toBeNull()
    })

    it("keeps a line whose day the calendar lacks WITHOUT its period, flagged, and tells why in the follow-up", () => {
        const line = "1|service|Tyre change|price|45,000 VND|-|2026-12-01|2026-02-30"
        const parsed = subject.parseFacts(line, [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed.facts).toHaveLength(1)
        expect(parsed.facts[0]).toMatchObject({
            value: "45,000 VND",
            validFrom: null,
            validTo: null,
            periodUnclear: true,
            periodNote: 'period written "2026-12-01|2026-02-30" is not a calendar day: the truth is filed without a period',
        })
        expect(parsed.facts[0]?.relative).toBeUndefined()
        // Filed, not refused: no refused line, nothing dropped, its line accounted for.
        expect(parsed).toMatchObject({ refused: [], dropped: 0, valid: true })
        expect(parsed.unaccounted).not.toContain("1:L2")
        expect(parsed.faults).toEqual([
            `${line} => from and to must each be a day YYYY-MM-DD that exists in the calendar, a form of rule 4b, ? (rule 4c) or -; as it is, the truth is kept without its period`,
        ])
        const told = subject.followUpOf("refused", null, parsed.unaccounted, parsed.faults, parsed.unclear)
        expect(told).toContain(line)
        expect(told).toContain("a day YYYY-MM-DD that exists in the calendar")
    })

    it("keeps a line with words in a period field without its period (never a guessed day)", () => {
        const parsed = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|today|next 14 days", [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed).toMatchObject({ refused: [], valid: true })
        expect(parsed.facts).toEqual([expect.objectContaining({ validFrom: null, validTo: null, periodUnclear: true })])
        expect(parsed.faults).toHaveLength(1)
    })

    it("keeps a line whose end comes before its start without its period, and tells why", () => {
        const line = "1|service|Tyre change|price|45,000 VND|-|2026-12-07|2026-12-01"
        const parsed = subject.parseFacts(line, [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed.facts).toEqual([
            expect.objectContaining({
                validFrom: null,
                validTo: null,
                periodUnclear: true,
                periodNote: 'period written "2026-12-07|2026-12-01" ends before it starts: the truth is filed without a period',
            }),
        ])
        expect(parsed.faults).toEqual([`${line} => its last day (to) comes before its first day (from); as it is, the truth is kept without its period`])
    })

    it("keeps a period the model marks ? (rule 4c) without it, flagged, with nothing to tell", () => {
        const parsed = subject.parseFacts("1|service|Tyre change|price|45,000 VND|-|?|-", [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed.facts).toEqual([expect.objectContaining({ validFrom: null, validTo: null, periodUnclear: true })])
        expect(parsed.facts[0]?.periodNote).toContain("could not be written as days")
        expect(parsed.faults).toEqual([])
        expect(SYSTEM_PROMPT).toContain("4c. A period the passage states")
    })

    it("files a computable period as written, with no flag", () => {
        const [fact] = subject.parseFacts("1|service|Tyre change|price|45,000 VND|-|2026-12-01|2026-12-07", [FEES], "Asia/Ho_Chi_Minh").facts
        expect(fact).toMatchObject({ validFrom: "2026-11-30T17:00:00.000Z", validTo: "2026-12-07T17:00:00.000Z" })
        expect(fact?.periodUnclear).toBeUndefined()
        expect(fact?.periodNote).toBeUndefined()
    })

    it("files a written period from midnight to midnight of the workspace's own zone", () => {
        const [london] = subject.parseFacts("1|service|Tyre change|price|45,000 VND|-|2026-12-01|2026-12-07", [FEES], "Europe/London").facts
        expect(london).toMatchObject({ validFrom: "2026-12-01T00:00:00.000Z", validTo: "2026-12-08T00:00:00.000Z" })
        const [york] = subject.parseFacts("1|service|Tyre change|price|45,000 VND|-|2026-12-01|2026-12-07", [FEES], "America/New_York").facts
        expect(york).toMatchObject({ validFrom: "2026-12-01T05:00:00.000Z", validTo: "2026-12-08T05:00:00.000Z" })
    })

    it("computes a period relative to the document's date in the workspace's own zone, a clock change included", () => {
        const [brake] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|D+0|D+13", [FEES], "Europe/London").facts
        if (brake === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no truth" } })
        expect(subject.resolvedPeriodOf(brake, day("2026-03-20"), "Europe/London")).toEqual({
            validFrom: "2026-03-20T00:00:00.000Z",
            validTo: "2026-04-02T23:00:00.000Z",
        })
    })

    it("tells a refused TRUTH line, not the prose around the lines", () => {
        const parsed = subject.parseFacts(["Here are the truths:", "1|service|Tyre change|price|99,000 VND|-|-|-"].join("\n"), [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed.refused).toHaveLength(2)
        expect(parsed.faults).toEqual(["1|service|Tyre change|price|99,000 VND|-|-|- => the value is not written in the passage the line names: copy the value as that passage writes it, and name the passage it is in"])
    })

    it("keeps two periods of one value as two truths (a window line is never folded into another)", () => {
        const passage: ReadPassage = { id: "w", hash: "hw", text: "Wash-and-fold is 10% off from 2026-12-01 to 2026-12-03 and from 2026-12-20 to 2026-12-22." }
        const parsed = subject.parseFacts(
            ["1|service|Wash-and-fold|discount|10%|-|2026-12-01|2026-12-03", "1|service|Wash-and-fold|discount|10%|-|2026-12-20|2026-12-22"].join("\n"),
            [passage],
            "Asia/Ho_Chi_Minh",
        )
        expect(parsed.facts.map((fact) => fact.validFrom)).toEqual(["2026-11-30T17:00:00.000Z", "2026-12-19T17:00:00.000Z"])
    })

    it("asks about lines skipped as unclear: they are not accounted for, and the follow-up says so", () => {
        const parsed = subject.parseFacts(["1|service|Tyre change|price|60,000 VND|-|-|-", "1|service|Tyre change|price|45,000 VND|-|2026-12-01|2026-12-07", "1|skip|L3|unclear"].join("\n"), [FEES], "Asia/Ho_Chi_Minh")
        expect(parsed.unclear).toEqual(["1:L3"])
        expect(parsed.unaccounted).toEqual(["1:L3"])
        expect(subject.followUpOf("unaccounted", null, parsed.unaccounted, parsed.faults, parsed.unclear)).toContain("You listed these lines as unclear: 1:L3")
        // A NONE that lists a line as unclear still leaves that line unaccounted.
        expect(subject.parseFacts("NONE\n1|skip|L3|unclear", [FEES], "Asia/Ho_Chi_Minh").unaccounted).toEqual(["1:L3"])
    })

    it("asks for the new value of a changed line, and for relative periods in their own forms, in the standing instructions", () => {
        expect(SYSTEM_PROMPT).toContain("A line that CHANGES a value")
        expect(SYSTEM_PROMPT).toContain("The value it replaces is not written")
        expect(SYSTEM_PROMPT).toContain("D+N = N days after the document's date")
        expect(SYSTEM_PROMPT).toContain("never use today's date")
    })
})

describe("extraction.policy: a period relative to the document's own date is computed by the code from the date the document states", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    it("reads the relative forms by format only", () => {
        expect(subject.relativeDayOf("D+14")).toEqual({ kind: "days", days: 14 })
        expect(subject.relativeDayOf("d - 1")).toEqual({ kind: "days", days: -1 })
        expect(subject.relativeDayOf("D>mon")).toEqual({ kind: "weekday", weekday: 1 })
        expect(subject.relativeDayOf("M+1:last")).toEqual({ kind: "month", months: 1, edge: "last" })
        expect(subject.relativeDayOf("M+0:first")).toEqual({ kind: "month", months: 0, edge: "first" })
        expect(subject.relativeDayOf("M+40:last")).toBeNull()
        expect(subject.relativeDayOf("D+9999")).toBeNull()
        expect(subject.relativeDayOf("D>xyz")).toBeNull()
        expect(subject.relativeDayOf("next monday")).toBeNull()
    })

    it.each([
        ["2026-01-31", "M+1:last", "2026-02-28"],
        ["2028-01-15", "M+1:last", "2028-02-29"],
        ["2026-12-20", "M+1:last", "2027-01-31"],
        ["2026-12-20", "M+1:first", "2027-01-01"],
        ["2026-11-12", "M+0:last", "2026-11-30"],
        ["2026-02-20", "D+13", "2026-03-05"],
        ["2028-02-28", "D+1", "2028-02-29"],
        ["2027-02-28", "D+1", "2027-03-01"],
        ["2026-12-31", "D+1", "2027-01-01"],
        ["2026-03-01", "D-1", "2026-02-28"],
        ["2026-03-31", "D+0", "2026-03-31"],
        // 2026-11-12 is a Thursday: the first Monday after it, and the next Thursday (never the day itself).
        ["2026-11-12", "D>mon", "2026-11-16"],
        ["2026-11-12", "D>thu", "2026-11-19"],
        ["2026-11-12", "D>fri", "2026-11-13"],
    ])("from the document's date %s, %s is %s", (reference, form, expected) => {
        const relative = relativeDayOf(form)
        expect(relative).not.toBeNull()
        if (relative === null) return
        expect(textOf(subject.resolvedDayOf(day(reference), relative))).toBe(expected)
    })

    it("computes a window with its last day included, as a written period", () => {
        const [brake] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|D+0|D+13", [FEES], "Asia/Ho_Chi_Minh").facts
        expect(brake).toMatchObject({ validFrom: null, validTo: null, relative: { written: "D+0|D+13" } })
        if (brake === undefined) return
        // The same window written as days gives the same instants: start of the first day, start of the day after the last (Vietnam time).
        const [written] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|2026-02-20|2026-03-05", [FEES], "Asia/Ho_Chi_Minh").facts
        expect(subject.resolvedPeriodOf(brake, day("2026-02-20"), "Asia/Ho_Chi_Minh")).toEqual({ validFrom: written?.validFrom, validTo: written?.validTo })
        expect(written).toMatchObject({ validFrom: "2026-02-19T17:00:00.000Z", validTo: "2026-03-05T17:00:00.000Z" })
    })

    it("computes 'until the end of next month' from a written start; a computed end before the start is filed without a period", () => {
        const [until] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|2026-01-10|M+1:last", [FEES], "Asia/Ho_Chi_Minh").facts
        expect(until).toBeDefined()
        if (until === undefined) return
        expect(subject.resolvedPeriodOf(until, day("2026-01-05"), "Asia/Ho_Chi_Minh")).toEqual({
            validFrom: "2026-01-09T17:00:00.000Z",
            validTo: "2026-02-28T17:00:00.000Z",
        })
        // The document dated after the end it implies: the period cannot be computed.
        expect(subject.resolvedPeriodOf(until, day("2025-11-02"), "Asia/Ho_Chi_Minh")).toBeNull()
        const unclear = subject.datedFactOf(until, { kind: "stated", day: day("2025-11-02"), line: "Issued 02/11/2025" }, "Asia/Ho_Chi_Minh")
        expect(unclear).toMatchObject({ validFrom: null, validTo: null, periodUnclear: true })
        expect(unclear.periodNote).toContain("cannot be computed")
    })

    it("files the computed period with its basis, or files the truth without a period, flagged, saying which date is missing", () => {
        const [brake] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|D+0|D+13", [FEES], "Asia/Ho_Chi_Minh").facts
        if (brake === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no truth" } })
        const stated = subject.datedFactOf(brake, { kind: "stated", day: day("2026-02-20"), line: "Notice of 20/02/2026" }, "Asia/Ho_Chi_Minh")
        expect(stated).toMatchObject({ validFrom: "2026-02-19T17:00:00.000Z", validTo: "2026-03-05T17:00:00.000Z" })
        expect(stated.periodNote).toBe("period computed from the document's date 2026-02-20 (\"Notice of 20/02/2026\"): D+0|D+13")
        const none = subject.datedFactOf(brake, { kind: "none" }, "Asia/Ho_Chi_Minh")
        expect(stated.periodUnclear).toBeUndefined()
        expect(none).toMatchObject({ validFrom: null, validTo: null, periodUnclear: true })
        expect(none.periodNote).toBe(
            "period stated from the document's own date (D+0|D+13), which the document does not state: the period cannot be computed, the truth is filed without a period",
        )
        expect(subject.datedFactOf(brake, { kind: "unread" }, "Asia/Ho_Chi_Minh")).toMatchObject({ periodUnclear: true })
        expect(subject.datedFactOf(brake, { kind: "unread" }, "Asia/Ho_Chi_Minh").periodNote).toContain("which could not be read from the document")
        // A mixed period (a written start, a relative end) with no stated date: filed without any period, never half of one.
        const [mixed] = subject.parseFacts("1|service|Brake tune-up|price|80,000 VND|-|2026-02-20|D+13", [FEES], "Asia/Ho_Chi_Minh").facts
        if (mixed === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no truth" } })
        expect(subject.datedFactOf(mixed, { kind: "none" }, "Asia/Ho_Chi_Minh")).toMatchObject({ validFrom: null, validTo: null, periodUnclear: true })
        // A truth with its period as written is left as it is.
        const [standing] = subject.parseFacts("1|service|Tyre change|price|60,000 VND|-|-|-", [FEES], "Asia/Ho_Chi_Minh").facts
        if (standing === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no truth" } })
        expect(subject.datedFactOf(standing, { kind: "none" }, "Asia/Ho_Chi_Minh")).toBe(standing)
    })
})

describe("extraction.policy: the date a document states as its own is read by the model and checked against its line", () => {
    let subject: typeof import("./extraction.policy")

    beforeEach(async () => {
        subject = await build()
    })

    const LINES = ["Bicycle workshop notice", "Issued 20/02/2026", "Brake tune-up costs 80,000 VND for the next 14 days."]

    it("takes a day the named line writes, and nothing on trust", () => {
        const shown = subject.dateLinesOf(LINES)
        expect(subject.parseDocumentDate("2|2026-02-20", shown)).toEqual({ kind: "stated", day: { year: 2026, month: 2, day: 20 }, line: "Issued 20/02/2026" })
        expect(subject.parseDocumentDate("L2|2026-02-20", shown)).toMatchObject({ kind: "stated" })
        // A day the line does not write, a line that does not exist, a day the calendar lacks: not read.
        expect(subject.parseDocumentDate("2|2026-02-21", shown)).toEqual({ kind: "unread" })
        expect(subject.parseDocumentDate("9|2026-02-20", shown)).toEqual({ kind: "unread" })
        expect(subject.parseDocumentDate("2|2026-02-30", shown)).toEqual({ kind: "unread" })
        expect(subject.parseDocumentDate("NONE", shown)).toEqual({ kind: "none" })
        expect(subject.parseDocumentDate("The document is from February.", shown)).toEqual({ kind: "unread" })
    })

    it("shows the start and the end of a long document, numbered as in the whole document", () => {
        const long = Array.from({ length: 200 }, (_, index) => `Line ${String(index + 1)} of the workshop's price list with some words.`)
        const shown = subject.dateLinesOf(long)
        expect(shown.get(1)).toBe(long[0])
        expect(shown.get(200)).toBe(long[199])
        expect(shown.has(100)).toBe(false)
        const prompt = subject.documentDatePrompt("Notice", shown)
        expect(prompt).toContain("...")
        expect(prompt).toContain(`L200 ${long[199] ?? ""}`)
        expect([...subject.dateLinesOf(LINES).keys()]).toEqual([1, 2, 3])
    })
})
