/** Vietnam is UTC+7 all year (no daylight saving). */
const VN_OFFSET_MS = 7 * 3_600_000

const HOUR_MS = 3_600_000

const MINUTES_PER_HOUR = 60

/** The parts of an instant on the Vietnam clock. */
export interface VnParts {
    /** The year. */
    readonly year: number
    /** The month, 0 to 11. */
    readonly month: number
    /** The day of the month. */
    readonly day: number
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** Minutes since local midnight. */
    readonly minute: number
}

/** The date and time of an instant on the Vietnam clock as zero-padded text. */
export interface VnClockText {
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** The time as HH:MM. */
    readonly time: string
    /** The date as DD/MM/YYYY. */
    readonly date: string
}

const pad2 = (value: number): string => String(value).padStart(2, "0")

/** The parts of an instant on the Vietnam clock. */
export const vnParts = (instant: Date): VnParts => {
    const local = new Date(instant.getTime() + VN_OFFSET_MS)
    return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth(),
        day: local.getUTCDate(),
        weekday: local.getUTCDay(),
        minute: local.getUTCHours() * MINUTES_PER_HOUR + local.getUTCMinutes(),
    }
}

/** The instant of `minute` (from midnight) on the Vietnam calendar day year-month-day. */
export const vnInstant = (year: number, month: number, day: number, minute: number): Date =>
    new Date(Date.UTC(year, month, day, 0, minute) - VN_OFFSET_MS)

/** The weekday, time and date text of an instant on the Vietnam clock. */
export const vnClockText = (instant: Date): VnClockText => {
    const parts = vnParts(instant)
    return {
        weekday: parts.weekday,
        time: `${pad2(Math.floor(parts.minute / MINUTES_PER_HOUR))}:${pad2(parts.minute % MINUTES_PER_HOUR)}`,
        date: `${pad2(parts.day)}/${pad2(parts.month + 1)}/${parts.year}`,
    }
}

/** The instant `hours` hours after `from`. */
export const addHours = (from: Date, hours: number): Date => new Date(from.getTime() + hours * HOUR_MS)

/** The instant `days` days after `from`. */
export const addDays = (from: Date, days: number): Date => addHours(from, days * 24)

/** Any date value a database driver answers (a Date or its text) as an ISO instant. */
export const isoOf = (value: Date | string): string => new Date(value).toISOString()

/** The same, null stays null. */
export const isoOrNull = (value: Date | string | null): string | null => (value === null ? null : isoOf(value))
