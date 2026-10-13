import { hhmmToMinutes, isOutsideHours, minutesToHhmm, parseHours, vnClock } from "./hours.policy"

describe("parseHours", () => {
    it.each([
        ["8h-21h", { from: 480, to: 1260 }],
        ["08:00 - 20:30", { from: 480, to: 1230 }],
        ["8:00-21:00", { from: 480, to: 1260 }],
        ["8h30 den 21h15", { from: 510, to: 1275 }],
        ["8 gi\u1edd 30 - 21 gi\u1edd", { from: 510, to: 1260 }],
    ])("reads the first two clock times of %p", (text, range) => {
        expect(parseHours(text)).toEqual(range)
    })

    it.each([null, undefined, "", "open all day", "8h only", "8h-8h", "30h-31h", "8:99-9:00"])(
        "reads no range from %p",
        (text) => {
            expect(parseHours(text)).toBeNull()
        },
    )
})

describe("hhmmToMinutes and minutesToHhmm", () => {
    it("converts both ways, and an unreadable time is midnight", () => {
        expect(hhmmToMinutes("08:30")).toBe(510)
        expect(hhmmToMinutes("nonsense")).toBe(0)
        expect(hhmmToMinutes("")).toBe(0)
        expect(minutesToHhmm(510)).toBe("08:30")
        expect(minutesToHhmm(1500)).toBe("01:00")
    })
})

describe("isOutsideHours", () => {
    it("tells whether a minute falls outside a window of the day", () => {
        const day = { from: 480, to: 1260 }

        expect(isOutsideHours(479, day)).toBe(true)
        expect(isOutsideHours(480, day)).toBe(false)
        expect(isOutsideHours(1259, day)).toBe(false)
        expect(isOutsideHours(1260, day)).toBe(true)
    })

    it("handles a window that crosses midnight", () => {
        const night = { from: 1200, to: 360 }

        expect(isOutsideHours(1300, night)).toBe(false)
        expect(isOutsideHours(100, night)).toBe(false)
        expect(isOutsideHours(700, night)).toBe(true)
    })
})

describe("vnClock", () => {
    it("reads the minute and the day on the clock of Vietnam", () => {
        expect(vnClock(new Date("2026-10-12T20:30:00Z"))).toEqual({ minute: 210, day: "2026-10-13" })
        expect(vnClock(new Date("2026-10-12T00:00:00Z"))).toEqual({ minute: 420, day: "2026-10-12" })
    })
})
