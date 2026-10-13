import type { HoursRange } from "../automations.contracts"

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const ZONE = "Asia/Ho_Chi_Minh"
const TIME_PATTERN = /(\d{1,2})\s*(?:[:h]\s*(\d{2})?|gi\u1edd\s*(\d{2})?)/gi

const toMinutes = (hours: string | undefined, minutes?: string): number | null => {
    const hh = Number(hours)
    const mm = minutes === undefined ? 0 : Number(minutes)
    return Number.isInteger(hh) && hh >= 0 && hh <= HOURS_PER_DAY && mm >= 0 && mm < MINUTES_PER_HOUR
        ? hh * MINUTES_PER_HOUR + mm
        : null
}

/**
 * The first two clock times in a free text ("8h-21h", "08:00 - 20:30", "8:00-21:00"), in minutes since midnight.
 * Null when the text has fewer than two, or when both are the same time.
 */
export const parseHours = (text: string | null | undefined): HoursRange | null => {
    const times = [...(text ?? "").matchAll(TIME_PATTERN)]
        .map((match) => toMinutes(match[1], match[2] ?? match[3]))
        .filter((value): value is number => value !== null)
    const [from, to] = times
    return from !== undefined && to !== undefined && from !== to ? { from, to } : null
}

/** `HH:MM` as minutes since midnight; an unreadable time is midnight. */
export const hhmmToMinutes = (hhmm: string): number => {
    const [hours, minutes] = hhmm.split(":")
    return toMinutes(hours, minutes) ?? 0
}

/** Minutes since midnight as `HH:MM`. */
export const minutesToHhmm = (minutes: number): string =>
    `${String(Math.floor(minutes / MINUTES_PER_HOUR) % HOURS_PER_DAY).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`

/** True when `minuteOfDay` is outside [from, to); a window that crosses midnight (from after to) is handled. */
export const isOutsideHours = (minuteOfDay: number, hours: HoursRange): boolean =>
    hours.from < hours.to
        ? minuteOfDay < hours.from || minuteOfDay >= hours.to
        : !(minuteOfDay >= hours.from || minuteOfDay < hours.to)

/** A moment on the Vietnam clock. */
export interface VnClock {
    /** Minutes since midnight. */
    readonly minute: number
    /** The calendar day, `yyyy-mm-dd`. */
    readonly day: string
}

/** Minutes since midnight and the calendar day (yyyy-mm-dd) in Vietnam time. */
export const vnClock = (at: Date): VnClock => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(at)
    const get = (type: string): string =>
        parts
            .filter((part) => part.type === type)
            .map((part) => part.value)
            .join("")
    return {
        minute: Number(get("hour")) * MINUTES_PER_HOUR + Number(get("minute")),
        day: `${get("year")}-${get("month")}-${get("day")}`,
    }
}
