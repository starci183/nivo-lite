import {
    dayWindow,
    hhmm,
    isReminderDue,
    isSummaryDue,
    lastWeekWindow,
    pad2,
    vnDateKey,
    vnParts,
    vnToIso,
    weekStartKey,
} from "./content-time.policy"

/** Monday 12 October 2026, 09:30 in Vietnam. */
const MONDAY = new Date("2026-10-12T02:30:00.000Z")

describe("vnParts", () => {
    it("shifts an instant into Vietnam time", () => {
        expect(vnParts(new Date("2026-10-11T18:05:00.000Z"))).toEqual({ y: 2026, m: 10, day: 12, h: 1, min: 5, dow: 1 })
    })
})

describe("vnToIso", () => {
    it("turns a Vietnam wall-clock time into its instant", () => {
        expect(vnToIso(2026, 10, 12, 9, 30)).toBe("2026-10-12T02:30:00.000Z")
        expect(vnToIso(2026, 10, 12)).toBe("2026-10-11T17:00:00.000Z")
    })
})

describe("pad2 and hhmm", () => {
    it("pads to two digits and reads hours and minutes in Vietnam time", () => {
        expect(pad2(7)).toBe("07")
        expect(hhmm("2026-10-12T02:05:00.000Z")).toBe("09:05")
    })
})

describe("vnDateKey and weekStartKey", () => {
    it("names the Vietnam date and the Monday of its week", () => {
        const sunday = new Date("2026-10-18T16:30:00.000Z")

        expect(vnDateKey(MONDAY)).toBe("2026-10-12")
        expect(weekStartKey(MONDAY)).toBe("2026-10-12")
        expect(vnDateKey(sunday)).toBe("2026-10-18")
        expect(weekStartKey(sunday)).toBe("2026-10-12")
        expect(weekStartKey(new Date("2026-10-18T17:30:00.000Z"))).toBe("2026-10-19")
    })
})

describe("dayWindow and lastWeekWindow", () => {
    it("spans the Vietnam day and the week before the current one", () => {
        expect(dayWindow(MONDAY)).toEqual({ from: "2026-10-11T17:00:00.000Z", to: "2026-10-12T17:00:00.000Z" })
        expect(lastWeekWindow(MONDAY)).toEqual({ from: "2026-10-04T17:00:00.000Z", to: "2026-10-11T17:00:00.000Z" })
    })
})

describe("isReminderDue", () => {
    it("is due from 07:00 until it was sent today", () => {
        expect(isReminderDue(MONDAY, undefined, false)).toBe(true)
        expect(isReminderDue(MONDAY, "2026-10-11", false)).toBe(true)
        expect(isReminderDue(MONDAY, "2026-10-12", false)).toBe(false)
        expect(isReminderDue(new Date("2026-10-11T23:00:00.000Z"), undefined, false)).toBe(false)
    })

    it("is due when an operator forces it", () => {
        expect(isReminderDue(MONDAY, "2026-10-12", true)).toBe(true)
    })
})

describe("isSummaryDue", () => {
    it("is due on Monday from 08:00 until it was sent this week", () => {
        expect(isSummaryDue(MONDAY, undefined, false)).toBe(true)
        expect(isSummaryDue(MONDAY, "2026-10-05", false)).toBe(true)
        expect(isSummaryDue(MONDAY, "2026-10-12", false)).toBe(false)
        expect(isSummaryDue(new Date("2026-10-11T23:30:00.000Z"), undefined, false)).toBe(false)
        expect(isSummaryDue(new Date("2026-10-13T03:00:00.000Z"), undefined, false)).toBe(false)
    })

    it("is due when an operator forces it", () => {
        expect(isSummaryDue(new Date("2026-10-13T03:00:00.000Z"), "2026-10-12", true)).toBe(true)
    })
})
