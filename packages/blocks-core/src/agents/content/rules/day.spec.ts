import { addDays, isDay, isoWeekdayOf, monthEndOf, weekStartOf } from "./day"

describe("content calendar days", () => {
    it("adds days across a month and a year", () => {
        expect(addDays("2026-11-30", 1)).toBe("2026-12-01")
        expect(addDays("2027-01-01", -1)).toBe("2026-12-31")
    })

    it("tells the ISO weekday, the Monday of the week and the last day of the month", () => {
        expect(isoWeekdayOf("2026-11-16")).toBe(1)
        expect(isoWeekdayOf("2026-11-22")).toBe(7)
        expect(weekStartOf("2026-11-22")).toBe("2026-11-16")
        expect(monthEndOf("2028-02-10")).toBe("2028-02-29")
    })

    it("knows a real calendar day from a text that is none", () => {
        expect(isDay("2026-11-13")).toBe(true)
        expect(isDay("2026-02-30")).toBe(false)
        expect(isDay("13/11/2026")).toBe(false)
    })
})
