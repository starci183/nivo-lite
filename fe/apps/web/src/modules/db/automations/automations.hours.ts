/** A window of the day in minutes since midnight. */
export interface HoursRange {
    readonly from: number
    readonly to: number
}

const MINUTES_PER_HOUR = 60
const HOURS_PER_DAY = 24
const TIME_PATTERN = /(\d{1,2})\s*(?:[:h]\s*(\d{2})?|giờ\s*(\d{2})?)/gi

const toMinutes = (hours: string | undefined, minutes?: string): number | null => {
    const hh = Number(hours)
    const mm = minutes === undefined ? 0 : Number(minutes)
    return Number.isInteger(hh) && hh >= 0 && hh <= HOURS_PER_DAY && mm >= 0 && mm < MINUTES_PER_HOUR
        ? hh * MINUTES_PER_HOUR + mm
        : null
}

/**
 * The first two clock times in a free text ("8h-21h", "08:00 - 20:30"), in minutes since midnight.
 * Null when the text has fewer than two, or when both are the same time.
 */
export const parseHours = (text: string | null | undefined): HoursRange | null => {
    const times = [...(text ?? "").matchAll(TIME_PATTERN)]
        .map((match) => toMinutes(match[1], match[2] ?? match[3]))
        .filter((value): value is number => value !== null)
    const [from, to] = times
    return from !== undefined && to !== undefined && from !== to ? { from, to } : null
}

/** Minutes since midnight as `HH:MM`. */
export const minutesToHhmm = (minutes: number): string =>
    `${String(Math.floor(minutes / MINUTES_PER_HOUR) % HOURS_PER_DAY).padStart(2, "0")}:${String(minutes % MINUTES_PER_HOUR).padStart(2, "0")}`
