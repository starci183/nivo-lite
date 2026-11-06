import { ageingOf, dueRecord, dueRowsOf, figureCellsOf, figuresRecord } from "./overview-view"
import type { DueWords, FigureWords, FiguresRecord } from "./overview-view"

const FIGURES: FiguresRecord = {
    periodKey: "this",
    income: { vnd: 84_200_000, count: 11 },
    receivable: { vnd: 31_650_000, count: 6 },
    unmatched: { vnd: 4_950_000, count: 3 },
    ageing: { d0: { count: 4 }, d30: { count: 1 }, d60: { count: 1 } },
}

const WORDS: FigureWords = {
    incomeTerm: { this: "income this", last: "income last" },
    incomeHint: "paid",
    receivableTerm: "receivable",
    receivableHint: "{count} open",
    unmatchedTerm: "unmatched",
    unmatchedHint: "{amount} unknown",
    ageingTerm: "ageing",
    ageingHint: "by age",
}

describe("figureCellsOf", () => {
    it("makes the four cells of the board: income, receivable, the unmatched count and the ageing counts", () => {
        const cells = figureCellsOf(figuresRecord.parse(FIGURES), WORDS)
        expect(cells.map((cell) => [cell.id, cell.term, cell.hint])).toEqual([
            ["income", "income this", "paid"],
            ["receivable", "receivable", "6 open"],
            ["unmatched", "unmatched", expect.stringContaining("unknown")],
            ["ageing", "ageing", "by age"],
        ])
        expect(cells[0]?.value.replace(/\s/g, " ")).toBe("84.200.000 ₫")
        expect(cells[2]?.value).toBe("3")
        expect(cells[3]?.value).toBe("4 / 1 / 1")
    })

    it("names last month in the income term", () => {
        expect(figureCellsOf({ ...FIGURES, periodKey: "last" }, WORDS)[0]?.term).toBe("income last")
    })

    it("refuses figures that lack a part", () => {
        expect(figuresRecord.safeParse({ ...FIGURES, income: 1 }).success).toBe(false)
    })
})

const DUE_WORDS: DueWords = {
    title: { vatMonth: "VAT m{period}", vatQuarter: "VAT q{period}", pit: "PIT {period}" },
    due: "Due {date}",
    left: "{count} days left",
    today: "Today",
}

describe("dueRowsOf", () => {
    it("writes the tax, the date day/month/year and the days left, or today", () => {
        const record = dueRecord.parse({
            rows: [
                { id: "a", kind: "vat", unit: "quarter", period: 4, dueDay: "2026-11-20", daysLeft: 15 },
                { id: "b", kind: "pit", unit: "month", period: 10, dueDay: "2026-11-20", daysLeft: 0 },
                { id: "c", kind: "vat", unit: "month", period: 10, dueDay: "2026-11-20", daysLeft: 3 },
            ],
        })
        expect(dueRowsOf(record.rows, DUE_WORDS)).toEqual([
            { id: "a", title: "VAT q4", description: "Due 20/11/2026", chip: "15 days left" },
            { id: "b", title: "PIT 10", description: "Due 20/11/2026", chip: "Today" },
            { id: "c", title: "VAT m10", description: "Due 20/11/2026", chip: "3 days left" },
        ])
    })

    it("refuses a month that is not one", () => {
        expect(
            dueRecord.safeParse({
                rows: [{ id: "a", kind: "vat", unit: "month", period: 13, dueDay: "x", daysLeft: 1 }],
            }).success,
        ).toBe(false)
    })
})

describe("ageingOf", () => {
    it("titles the ageing with the open invoices in all and draws one gauge per bucket with its count", () => {
        const ageing = ageingOf(FIGURES, {
            buckets: ["to 30", "31 to 60", "over 60"],
            total: "{count} open",
            count: "{count} inv",
        })
        expect(ageing.total).toBe("6 open")
        expect(ageing.points.map((point) => [point.id, point.label, point.value, point.valueLabel])).toEqual([
            ["d0", "to 30", 4, "4 inv"],
            ["d1", "31 to 60", 1, "1 inv"],
            ["d2", "over 60", 1, "1 inv"],
        ])
    })
})
