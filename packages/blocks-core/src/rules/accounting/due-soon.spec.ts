import { dueSoonOf } from "./due-soon"

const summary = (now: string, vat: "monthly" | "quarterly", horizon?: number): ReadonlyArray<unknown> =>
    dueSoonOf(new Date(now), vat, horizon).map((item) => [
        item.kind,
        item.unit,
        item.period,
        item.dueDay,
        item.daysLeft,
    ])

describe("dueSoonOf", () => {
    it("lists value added tax by quarter for a shop that files quarterly, with the income tax of the month", () => {
        expect(summary("2026-11-04T11:30:00.000Z", "quarterly")).toEqual([
            ["vat", "quarter", 4, "2026-11-20", 16],
            ["pit", "month", 10, "2026-11-20", 16],
        ])
    })

    it("lists value added tax by month for a shop that files monthly", () => {
        expect(summary("2026-11-04T11:30:00.000Z", "monthly")).toEqual([
            ["vat", "month", 10, "2026-11-20", 16],
            ["pit", "month", 10, "2026-11-20", 16],
        ])
    })

    it("lists only the income tax in a month where no quarterly declaration falls due", () => {
        expect(summary("2026-12-01T03:00:00.000Z", "quarterly", 20)).toEqual([["pit", "month", 11, "2026-12-20", 19]])
    })

    it("counts the day itself, looks to the next month and wraps the year", () => {
        expect(dueSoonOf(new Date("2026-11-20T03:00:00.000Z"), "monthly").map((item) => item.daysLeft)).toEqual([
            0, 0, 30, 30,
        ])
        expect(summary("2026-12-25T03:00:00.000Z", "monthly")).toEqual([
            ["vat", "month", 12, "2027-01-20", 26],
            ["pit", "month", 12, "2027-01-20", 26],
        ])
    })

    it("takes the horizon it is given", () => {
        expect(dueSoonOf(new Date("2026-11-04T11:30:00.000Z"), "monthly", 5)).toEqual([])
    })
})
