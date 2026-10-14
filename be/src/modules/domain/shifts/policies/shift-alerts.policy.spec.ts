import type { AlertShift } from "./shift-alerts.policy"
import {
    alertMinutesOf,
    dueAlerts,
    isNoShowDue,
    isRemindDue,
    minutesLate,
    monthToClose,
    shiftWindow,
    toAlertShift,
} from "./shift-alerts.policy"
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

    it("rounds positive settings and rejects nonfinite or negative settings and defaults", () => {
        expect(alertMinutesOf({ beforeMinutes: 25.6, noShowMinutes: 4.4 }, null, null)).toEqual({
            remindMinutes: 26,
            noshowMinutes: 4,
        })
        expect(alertMinutesOf({ beforeMinutes: "invalid", noShowMinutes: -5 }, Infinity, -1)).toEqual({
            remindMinutes: 60,
            noshowMinutes: 10,
        })
    })
})

describe("toAlertShift", () => {
    it("maps database times and preserves the shift identifiers, status and flags", () => {
        expect(
            toAlertShift({
                id: "s-1",
                schedule_id: "schedule-1",
                shift_date: "2026-10-14",
                start_time: "08:00:00",
                end_time: "12:00:00",
                position_id: "p",
                staff_id: "a",
                status: "published",
                checked_in: true,
                reminded: true,
                alerted: true,
            }),
        ).toEqual(item({ checkedIn: true, reminded: true, alerted: true }))
        expect(shiftWindow(item().shift)).toEqual({
            startMs: Date.parse("2026-10-14T08:00:00+07:00"),
            endMs: Date.parse("2026-10-14T12:00:00+07:00"),
        })
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

    it("returns the full no-show item and omits shifts whose alert was already sent", () => {
        const shift = item()
        expect(dueAlerts([shift, item({ checkedIn: true })], minutes, at(8 * 60 + 10))).toEqual([
            { item: shift, kind: "noshow" },
        ])
        expect(dueAlerts([item({ reminded: true })], minutes, at(7 * 60))).toEqual([])
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

    it("clamps and rounds configured days and supplies missing or invalid clock components", () => {
        expect(monthToClose({ day: 30, time: "00:00" }, { date: "2026-10-27", minute: 0 })).toBeNull()
        expect(monthToClose({ day: 30, time: "00:00" }, { date: "2026-10-28", minute: 0 })).toBe("2026-09")
        expect(monthToClose({ day: -2, time: "9" }, { date: "2026-10-01", minute: 540 })).toBe("2026-09")
        expect(monthToClose({ day: 1.6, time: "invalid:invalid" }, { date: "2026-10-02", minute: 0 })).toBe("2026-09")
        expect(monthToClose({ day: "invalid", time: 10 }, { date: "2026-10-01", minute: 540 })).toBe("2026-09")
    })
})
