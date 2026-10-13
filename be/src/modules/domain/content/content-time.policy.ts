/** Vietnam is UTC+7 all year (no daylight saving), so local <-> UTC is a fixed shift. */
const VN_OFFSET_MS = 7 * 3_600_000

/** The wall-clock parts of an instant in Vietnam. */
export interface VnParts {
    /** Year. */
    readonly y: number
    /** Month 1..12. */
    readonly m: number
    /** Day of the month 1..31. */
    readonly day: number
    /** Hour 0..23. */
    readonly h: number
    /** Minute 0..59. */
    readonly min: number
    /** Day of the week, 0 = Sunday. */
    readonly dow: number
}

/** A window of two ISO instants: it starts at `from` and ends before `to`. */
export interface TimeWindow {
    /** The first instant of the window. */
    readonly from: string
    /** The first instant after the window. */
    readonly to: string
}

/** The Vietnam wall-clock parts of an instant. */
export const vnParts = (instant: Date): VnParts => {
    const shifted = new Date(instant.getTime() + VN_OFFSET_MS)
    return {
        y: shifted.getUTCFullYear(),
        m: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        h: shifted.getUTCHours(),
        min: shifted.getUTCMinutes(),
        dow: shifted.getUTCDay(),
    }
}

/** The ISO instant of a Vietnam wall-clock time. */
export const vnToIso = (y: number, m: number, day: number, h: number = 0, min: number = 0): string =>
    new Date(Date.UTC(y, m - 1, day, h, min) - VN_OFFSET_MS).toISOString()

/** A number as two digits. */
export const pad2 = (value: number): string => String(value).padStart(2, "0")

/** The Vietnam date of an instant as yyyy-mm-dd. */
export const vnDateKey = (instant: Date): string => {
    const parts = vnParts(instant)
    return `${parts.y}-${pad2(parts.m)}-${pad2(parts.day)}`
}

/** Monday-first weekday 1..7 of a calendar day. */
const isoWeekday = (y: number, m: number, day: number): number => {
    const weekday = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
    return weekday === 0 ? 7 : weekday
}

/** Monday of the week of a Vietnam date (yyyy-mm-dd). */
export const weekStartKey = (instant: Date): string => {
    const parts = vnParts(instant)
    const monday = new Date(Date.UTC(parts.y, parts.m - 1, parts.day - (isoWeekday(parts.y, parts.m, parts.day) - 1)))
    return `${monday.getUTCFullYear()}-${pad2(monday.getUTCMonth() + 1)}-${pad2(monday.getUTCDate())}`
}

/** The hour and minute of an instant in Vietnam as hh:mm. */
export const hhmm = (iso: string): string => {
    const parts = vnParts(new Date(iso))
    return `${pad2(parts.h)}:${pad2(parts.min)}`
}

/** The day of `instant` in Vietnam, midnight to midnight. */
export const dayWindow = (instant: Date): TimeWindow => {
    const parts = vnParts(instant)
    return { from: vnToIso(parts.y, parts.m, parts.day), to: vnToIso(parts.y, parts.m, parts.day + 1) }
}

/** The week before the week of `instant` (Monday to Monday, Vietnam time). */
export const lastWeekWindow = (instant: Date): TimeWindow => {
    const [y = 0, m = 1, d = 1] = weekStartKey(instant).split("-").map(Number)
    return { from: vnToIso(y, m, d - 7), to: vnToIso(y, m, d) }
}

/** True when the daily reminder is due: from 07:00 Vietnam time and not yet sent today. An operator forces it. */
export const isReminderDue = (instant: Date, sentDay: string | undefined, force: boolean): boolean =>
    force || (vnParts(instant).h >= 7 && sentDay !== vnDateKey(instant))

/** True when the weekly summary is due: Monday from 08:00 Vietnam time and not yet sent this week. An operator forces it. */
export const isSummaryDue = (instant: Date, sentWeek: string | undefined, force: boolean): boolean => {
    const parts = vnParts(instant)
    return force || (parts.dow === 1 && parts.h >= 8 && sentWeek !== weekStartKey(instant))
}
