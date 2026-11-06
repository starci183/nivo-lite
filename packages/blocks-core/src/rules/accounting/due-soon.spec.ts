import { dueSoonOf } from "./due-soon"

describe("dueSoonOf", () => {
    it("lists both declarations that fall due on the 20th within 30 days, soonest first", () => {
        const items = dueSoonOf(new Date("2026-11-04T11:30:00.000Z"))
        expect(items.map((item) => [item.kind, item.month, item.dueDay, item.daysLeft])).toEqual([
            ["vat", 10, "2026-11-20", 16],
            ["pit", 10, "2026-11-20", 16],
        ])
    })

    it("counts the day itself, looks past the 20th to the next month and wraps the year", () => {
        expect(dueSoonOf(new Date("2026-11-20T03:00:00.000Z")).map((item) => item.daysLeft)).toEqual([0, 0, 30, 30])
        const later = dueSoonOf(new Date("2026-12-25T03:00:00.000Z"))
        expect(later.map((item) => [item.month, item.dueDay])).toEqual([
            [12, "2027-01-20"],
            [12, "2027-01-20"],
        ])
    })

    it("takes the horizon it is given", () => {
        expect(dueSoonOf(new Date("2026-11-04T11:30:00.000Z"), 5)).toEqual([])
    })
})
