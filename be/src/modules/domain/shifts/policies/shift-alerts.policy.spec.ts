import type { AlertShift } from "./shift-alerts.policy"
import { alertMinutesOf, dueAlerts, isNoShowDue, isRemindDue, minutesLate, monthToClose } from "./shift-alerts.policy"
import { instantOf } from "./time.policy"

const item = (flags: Partial<Omit<AlertShift, "shift">> = {}): AlertShift => ({
    shift: {
        id: "s-1",
        date: "2026-10-14",
        start: "08:00",
        end: "12:00",
        positionId: "p",
        staffId: "a",
        status: "published",
    },
    checkedIn: false,
    reminded: false,
    alerted: false,
    ...flags,
})

const at = (minute: number): number => instantOf("2026-10-14", minute).getTime()
const minutes = { remindMinutes: 60, noshowMinutes: 10 }

describe("alertMinutesOf", () => {
    it("takes the automation settings first, then the module defaults, then the built-in ones", () => {
        expect(alertMinutesOf({ beforeMinutes: 30, noShowMinutes: "15" }, 90, 20)).toEqual({
            remindMinutes: 30,
            noshowMinutes: 15,
        })
        expect(alertMinutesOf({ beforeMinutes: 0 }, 90, 20)).toEqual({ remindMinutes: 90, noshowMinutes: 20 })
        expect(alertMinutesOf(null, null, null)).toEqual({ remindMinutes: 60, noshowMinutes: 10 })
    })
})

describe("isRemindDue", () => {
    it("is due inside the lead time before the start, once", () => {
        expect(isRemindDue(item(), minutes, at(6 * 60 + 59))).toBe(false)
        expect(isRemindDue(item(), minutes, at(7 * 60))).toBe(true)
        expect(isRemindDue(item(), minutes, at(8 * 60))).toBe(false)
        expect(isRemindDue(item({ reminded: true }), minutes, at(7 * 60 + 30))).toBe(false)
    })
})

describe("isNoShowDue", () => {
    it("is due after the delay while the shift runs, when nobody checked in or was told", () => {
        expect(isNoShowDue(item(), minutes, at(8 * 60 + 9))).toBe(false)
        expect(isNoShowDue(item(), minutes, at(8 * 60 + 10))).toBe(true)
        expect(isNoShowDue(item({ checkedIn: true }), minutes, at(9 * 60))).toBe(false)
        expect(isNoShowDue(item({ alerted: true }), minutes, at(9 * 60))).toBe(false)
        expect(isNoShowDue(item(), minutes, at(12 * 60))).toBe(false)
    })
})

describe("dueAlerts", () => {
    it("lists what each shift is due for", () => {
        expect(dueAlerts([item()], minutes, at(7 * 60)).map((due) => due.kind)).toEqual(["remind"])
    })
})

describe("minutesLate", () => {
    it("counts whole minutes since the start, at least one", () => {
        expect(minutesLate(item().shift, at(8 * 60 + 12))).toBe(12)
        expect(minutesLate(item().shift, at(8 * 60))).toBe(1)
    })
})

describe("monthToClose", () => {
    it("closes the previous month from the configured day and time", () => {
        expect(monthToClose({ day: 2, time: "09:00" }, { date: "2026-10-01", minute: 600 })).toBeNull()
        expect(monthToClose({ day: 2, time: "09:00" }, { date: "2026-10-02", minute: 539 })).toBeNull()
        expect(monthToClose({ day: 2, time: "09:00" }, { date: "2026-10-02", minute: 540 })).toBe("2026-09")
        expect(monthToClose(null, { date: "2026-01-05", minute: 600 })).toBe("2025-12")
    })
})
