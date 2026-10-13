import {
    addDays,
    hhmmOf,
    bookingIsoOf,
    isoWeekday,
    localDate,
    localHhmm,
    mondayOf,
    zoneOffsetMin,
    zonedMs,
} from "./zoned-time.policy"

const HCM = "Asia/Ho_Chi_Minh"
const NEW_YORK = "America/New_York"

describe("zoned-time.policy", () => {
    describe("zoneOffsetMin", () => {
        it("is a fixed seven hours for Ho Chi Minh City", () => {
            expect(zoneOffsetMin(Date.UTC(2026, 0, 1), HCM)).toBe(420)
            expect(zoneOffsetMin(Date.UTC(2026, 6, 1), HCM)).toBe(420)
        })

        it("follows the clock change of a zone with daylight saving time", () => {
            expect(zoneOffsetMin(Date.UTC(2026, 0, 15, 12), NEW_YORK)).toBe(-300)
            expect(zoneOffsetMin(Date.UTC(2026, 6, 15, 12), NEW_YORK)).toBe(-240)
        })
    })

    describe("zonedMs", () => {
        it("turns a wall-clock reading into its instant", () => {
            expect(zonedMs("2026-10-08", "09:30", HCM)).toBe(Date.UTC(2026, 9, 8, 2, 30))
            expect(zonedMs("2026-07-01", "12:00", NEW_YORK)).toBe(Date.UTC(2026, 6, 1, 16, 0))
        })

        it("settles midnight on the previous UTC day for a zone ahead of UTC", () => {
            expect(zonedMs("2026-10-08", "00:00", HCM)).toBe(Date.UTC(2026, 9, 7, 17, 0))
        })
    })

    describe("localDate and localHhmm", () => {
        it("read an instant on the wall clock of the zone", () => {
            const ms = Date.UTC(2026, 9, 8, 17, 5)
            expect(localDate(ms, HCM)).toBe("2026-10-09")
            expect(localHhmm(ms, HCM)).toBe("00:05")
            expect(localDate(ms, NEW_YORK)).toBe("2026-10-08")
            expect(localHhmm(ms, NEW_YORK)).toBe("13:05")
        })
    })

    describe("isoWeekday", () => {
        it("numbers Monday 1 and Sunday 7", () => {
            expect(isoWeekday("2026-10-12")).toBe(1)
            expect(isoWeekday("2026-10-14")).toBe(3)
            expect(isoWeekday("2026-10-11")).toBe(7)
        })
    })

    describe("addDays and mondayOf", () => {
        it("moves across month and year ends in both directions", () => {
            expect(addDays("2026-10-31", 1)).toBe("2026-11-01")
            expect(addDays("2026-01-01", -1)).toBe("2025-12-31")
            expect(addDays("2026-10-12", 0)).toBe("2026-10-12")
        })

        it("finds the Monday of the week of any day", () => {
            expect(mondayOf("2026-10-12")).toBe("2026-10-12")
            expect(mondayOf("2026-10-14")).toBe("2026-10-12")
            expect(mondayOf("2026-10-11")).toBe("2026-10-05")
        })
    })

    describe("hhmmOf", () => {
        it("keeps hours and minutes of a database time", () => {
            expect(hhmmOf("09:30:00")).toBe("09:30")
            expect(hhmmOf("18:00")).toBe("18:00")
        })
    })

    describe("bookingIsoOf", () => {
        it("writes an instant in ISO 8601", () => {
            expect(bookingIsoOf(Date.UTC(2026, 9, 12, 2, 30))).toBe("2026-10-12T02:30:00.000Z")
        })
    })
})
