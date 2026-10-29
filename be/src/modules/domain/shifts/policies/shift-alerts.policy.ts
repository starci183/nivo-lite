import type { Shift, WallClock } from "../shifts.contracts"
import type { AlertShiftRead } from "../persistence/shifts-alerts.reads"
import { DEFAULT_SETTINGS } from "./row-mappers.policy"
import { hhmm, instantOf, previousMonth, toMin } from "./time.policy"

const MS_PER_MIN = 60_000

/** How long before a shift the reminder goes out and how long after its start a missing check-in is reported. */
export interface AlertMinutes {
    /** Minutes before the start. */
    readonly remindMinutes: number
    /** Minutes after the start. */
    readonly noshowMinutes: number
}

/** A live assigned shift with what already happened to it. */
export interface AlertShift {
    /** The shift. */
    readonly shift: Shift
    /** The person checked in. */
    readonly checkedIn: boolean
    /** The person was reminded. */
    readonly reminded: boolean
    /** The managers were told nobody checked in. */
    readonly alerted: boolean
}

/** What a shift is due for now. */
export type AlertKind = "remind" | "noshow"

const positive = (value: unknown): number | null => {
    const number = Number(value)
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null
}

/** The automation's own settings (when the owner set them) win over the module defaults, which win over the built-in ones. */
export const alertMinutesOf = (
    config: Readonly<Record<string, unknown>> | null,
    remindDefault: number | null,
    noshowDefault: number | null,
): AlertMinutes => ({
    remindMinutes: positive(config?.beforeMinutes) ?? positive(remindDefault) ?? DEFAULT_SETTINGS.remindMinutes,
    noshowMinutes: positive(config?.noShowMinutes) ?? positive(noshowDefault) ?? DEFAULT_SETTINGS.noshowMinutes,
})

/** A shift row with its flags. */
export const toAlertShift = (row: AlertShiftRead): AlertShift => ({
    shift: {
        id: row.id,
        date: row.shift_date,
        start: hhmm(row.start_time),
        end: hhmm(row.end_time),
        positionId: row.position_id,
        staffId: row.staff_id,
        status: row.status,
    },
    checkedIn: row.checked_in,
    reminded: row.reminded,
    alerted: row.alerted,
})

/** The start and end instants of a shift, in milliseconds. */
export interface ShiftWindow {
    /** The start. */
    readonly startMs: number
    /** The end. */
    readonly endMs: number
}

/** A shift due for an alert, with which one. */
export interface DueAlert {
    /** The shift. */
    readonly item: AlertShift
    /** The alert. */
    readonly kind: AlertKind
}

/** The start and end instants of a shift. */
export const shiftWindow = (shift: Shift): ShiftWindow => ({
    startMs: instantOf(shift.date, toMin(shift.start)).getTime(),
    endMs: instantOf(shift.date, toMin(shift.end)).getTime(),
})

/** True while the reminder of a shift is due: inside the lead time, before the start, and not sent yet. */
export const isRemindDue = (item: AlertShift, minutes: AlertMinutes, nowMs: number): boolean => {
    const { startMs } = shiftWindow(item.shift)
    return !item.reminded && nowMs < startMs && nowMs >= startMs - minutes.remindMinutes * MS_PER_MIN
}

/** True while a missing check-in should be reported: past the delay, before the end, nobody checked in and nobody was told. */
export const isNoShowDue = (item: AlertShift, minutes: AlertMinutes, nowMs: number): boolean => {
    const { startMs, endMs } = shiftWindow(item.shift)
    return !item.checkedIn && !item.alerted && nowMs >= startMs + minutes.noshowMinutes * MS_PER_MIN && nowMs < endMs
}

/** What each shift is due for now. */
export const dueAlerts = (
    items: ReadonlyArray<AlertShift>,
    minutes: AlertMinutes,
    nowMs: number,
): ReadonlyArray<DueAlert> =>
    items.flatMap((item) => [
        ...(isRemindDue(item, minutes, nowMs) ? [{ item, kind: "remind" as const }] : []),
        ...(isNoShowDue(item, minutes, nowMs) ? [{ item, kind: "noshow" as const }] : []),
    ])

/** Whole minutes since a shift started, at least one (the no-show line says how late it is). */
export const minutesLate = (shift: Shift, nowMs: number): number =>
    Math.max(1, Math.round((nowMs - shiftWindow(shift).startMs) / MS_PER_MIN))

/**
 * The month to close now, or null: from the configured day of the month (1 to 28, default 1) and time (default 09:00, Vietnam time)
 * onwards, the month before the current one is due.
 */
export const monthToClose = (config: Readonly<Record<string, unknown>> | null, clock: WallClock): string | null => {
    const day = Math.min(28, Math.max(1, Math.round(Number(config?.day)) || 1))
    const time = typeof config?.time === "string" ? config.time : "09:00"
    const [hour = 0, minute = 0] = time.split(":").map(Number)
    const at = (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0)
    if (Number(clock.date.slice(8, 10)) < day || clock.minute < at) return null
    return previousMonth(clock.date)
}
