import { addDays, addHours, hiringIsoOf, isoOrNull, vnClockText, vnInstant, vnClockParts } from "./vn-time.policy"

describe("hiring Vietnam time policy", () => {
    it("reads calendar parts at the Vietnam date boundary", () => {
        expect(vnClockParts(new Date("2026-12-31T17:05:00.000Z"))).toEqual({
            year: 2027,
            month: 0,
            day: 1,
            weekday: 5,
            minute: 5,
        })
        expect(vnClockParts(new Date("2026-10-13T02:30:00.000Z"))).toEqual({
            year: 2026,
            month: 9,
            day: 13,
            weekday: 2,
            minute: 570,
        })
    })

    it("builds instants from local calendar dates and minutes", () => {
        expect(vnInstant(2027, 0, 1, 5)).toEqual(new Date("2026-12-31T17:05:00.000Z"))
        expect(vnInstant(2026, 9, 13, 570)).toEqual(new Date("2026-10-13T02:30:00.000Z"))
    })

    it("formats local weekdays, dates and times with two-digit fields", () => {
        expect(vnClockText(new Date("2026-12-31T17:05:00.000Z"))).toEqual({
            weekday: 5,
            time: "00:05",
            date: "01/01/2027",
        })
        expect(vnClockText(new Date("2026-10-13T16:59:00.000Z"))).toEqual({
            weekday: 2,
            time: "23:59",
            date: "13/10/2026",
        })
    })

    it("adds signed hours and days without changing the input date", () => {
        const from = new Date("2026-10-13T02:30:00.000Z")

        expect(addHours(from, 1.5)).toEqual(new Date("2026-10-13T04:00:00.000Z"))
        expect(addHours(from, -3)).toEqual(new Date("2026-10-12T23:30:00.000Z"))
        expect(addDays(from, 2)).toEqual(new Date("2026-10-15T02:30:00.000Z"))
        expect(from).toEqual(new Date("2026-10-13T02:30:00.000Z"))
    })

    it("converts driver date values to ISO text and preserves null", () => {
        expect(hiringIsoOf(new Date("2026-10-13T02:30:00.000Z"))).toBe("2026-10-13T02:30:00.000Z")
        expect(hiringIsoOf("2026-10-13T09:30:00+07:00")).toBe("2026-10-13T02:30:00.000Z")
        expect(isoOrNull(null)).toBeNull()
        expect(isoOrNull("2026-10-13T09:30:00+07:00")).toBe("2026-10-13T02:30:00.000Z")
        expect(isoOrNull(new Date("2026-10-13T02:30:00.000Z"))).toBe("2026-10-13T02:30:00.000Z")
    })
})
