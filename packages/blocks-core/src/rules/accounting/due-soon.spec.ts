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
    it("falls due for the fourth quarter on 31 January for a shop that files quarterly", () => {
        expect(summary("2027-01-12T03:00:00.000Z", "quarterly")).toEqual([
            ["pit", "month", 12, "2027-01-20", 8],
            ["vat", "quarter", 4, "2027-01-31", 19],
        ])
    })

    it("falls due for the first, the second and the third quarter on the last day of April, July and October", () => {
        expect(summary("2026-04-10T03:00:00.000Z", "quarterly")).toEqual([
            ["pit", "month", 3, "2026-04-20", 10],
            ["vat", "quarter", 1, "2026-04-30", 20],
        ])
        expect(summary("2026-07-25T03:00:00.000Z", "quarterly")).toEqual([
            ["vat", "quarter", 2, "2026-07-31", 6],
            ["pit", "month", 7, "2026-08-20", 26],
        ])
        expect(summary("2026-10-20T03:00:00.000Z", "quarterly")).toEqual([
            ["pit", "month", 9, "2026-10-20", 0],
            ["vat", "quarter", 3, "2026-10-31", 11],
        ])
    })

    it("lists only the income tax in a month where no quarterly declaration is near", () => {
        expect(summary("2026-11-04T11:30:00.000Z", "quarterly")).toEqual([["pit", "month", 10, "2026-11-20", 16]])
    })

    it("falls due on the 20th of the following month for a shop that files monthly, value added tax first", () => {
        expect(summary("2026-11-04T11:30:00.000Z", "monthly")).toEqual([
            ["vat", "month", 10, "2026-11-20", 16],
            ["pit", "month", 10, "2026-11-20", 16],
        ])
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
