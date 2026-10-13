/** Vietnam is UTC+7 all year (no daylight saving), so local to UTC is a fixed shift. */
const VN_OFFSET_MS = 7 * 3_600_000

/** The calendar fields of an instant in Vietnam time. */
export interface VnParts {
    readonly y: number
    readonly m: number
    readonly day: number
    readonly h: number
    readonly min: number
    readonly dow: number
}

/** A parsed day. */
export interface DayParts {
    readonly y: number
    readonly m: number
    readonly day: number
}

/** A year and a month (1..12). */
export interface YearMonth {
    readonly y: number
    readonly m: number
}

/** Splits an instant into Vietnam wall-clock fields. */
export const vietnamClock = (d: Date): VnParts => {
    const t = new Date(d.getTime() + VN_OFFSET_MS)
    return {
        y: t.getUTCFullYear(),
        m: t.getUTCMonth() + 1,
        day: t.getUTCDate(),
        h: t.getUTCHours(),
        min: t.getUTCMinutes(),
        dow: t.getUTCDay(),
    }
}

/** The ISO instant of a Vietnam wall-clock time. */
export const vnToIso = (y: number, m: number, day: number, h = 0, min = 0): string =>
    new Date(Date.UTC(y, m - 1, day, h, min) - VN_OFFSET_MS).toISOString()

/** Two-digit zero padding. */
export const pad2 = (n: number): string => String(n).padStart(2, "0")

/** The yyyy-mm-dd key of an instant in Vietnam time. */
export const vnDateKey = (d: Date): string => {
    const p = vietnamClock(d)
    return `${p.y}-${pad2(p.m)}-${pad2(p.day)}`
}

/** Days in a month (m is 1..12). */
export const daysInMonth = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Monday-first weekday 1..7 of a calendar day. */
export const isoWeekdayOf = (y: number, m: number, day: number): number => {
    const w = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
    return w === 0 ? 7 : w
}

/** The yyyy-mm key of a month. */
export const monthKey = (y: number, m: number): string => `${y}-${pad2(m)}`

/** Parses a yyyy-mm key, or returns null when it is not a plausible month. */
export const parseMonth = (value: string | null | undefined): YearMonth | null => {
    const match = /^(\d{4})-(\d{2})$/.exec(value ?? "")
    if (match === null) return null
    const y = Number(match[1])
    const m = Number(match[2])
    return m >= 1 && m <= 12 && y >= 2020 && y <= 2100 ? { y, m } : null
}

/** Shifts a month by a number of months. */
export const shiftMonth = (y: number, m: number, by: number): YearMonth => {
    const x = new Date(Date.UTC(y, m - 1 + by, 1))
    return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1 }
}

/** The ISO instants that bound a Vietnam-time month: [from, to). */
export const monthRange = (y: number, m: number): { readonly from: string; readonly to: string } => {
    const next = shiftMonth(y, m, 1)
    return { from: vnToIso(y, m, 1), to: vnToIso(next.y, next.m, 1) }
}

/** "25/12/2026" for a Vietnam-time instant. */
export const dateText = (iso: string | null): string => {
    if (iso === null) return ""
    const p = vietnamClock(new Date(iso))
    return `${pad2(p.day)}/${pad2(p.m)}/${p.y}`
}

/** "19:30" for a Vietnam-time instant. */
export const timeText = (iso: string | null): string => {
    if (iso === null) return ""
    const p = vietnamClock(new Date(iso))
    return `${pad2(p.h)}:${pad2(p.min)}`
}

/** "19:30 25/12/2026". */
export const dateTimeText = (iso: string | null): string => (iso === null ? "" : `${timeText(iso)} ${dateText(iso)}`)

/** Parses "25/12/2026" (also 25-12-2026 and 25.12.2026) into parts, or null. */
export const parseDateText = (value: string): DayParts | null => {
    const match = /^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\s*$/.exec(value)
    if (match === null) return null
    const day = Number(match[1])
    const m = Number(match[2])
    const y = Number(match[3])
    if (m < 1 || m > 12 || day < 1 || y < 2020 || y > 2100) return null
    return day <= daysInMonth(y, m) ? { y, m, day } : null
}

/** Parses "19:30" (or 19h30) into parts, or null. */
export const parseTimeText = (value: string): { readonly h: number; readonly min: number } | null => {
    const match = /^\s*([01]?\d|2[0-3])[:h]([0-5]\d)\s*$/.exec(value)
    return match === null ? null : { h: Number(match[1]), min: Number(match[2]) }
}

/** Why a typed date or time was refused. */
export type InstantError = "date_invalid" | "time_invalid"

/** Date text plus time text to an ISO instant (Vietnam time); null when the date is empty; an error code when either is malformed. */
export const toInstant = (date: string, time: string, fallbackTime = "09:00"): string | null | InstantError => {
    if (date.trim() === "") return null
    const d = parseDateText(date)
    if (d === null) return "date_invalid"
    const t = parseTimeText(time.trim() === "" ? fallbackTime : time.trim())
    if (t === null) return "time_invalid"
    return vnToIso(d.y, d.m, d.day, t.h, t.min)
}

/** The same wall-clock time on another calendar day. */
export const moveToDay = (iso: string | null, y: number, m: number, day: number): string => {
    const p = iso === null ? null : vietnamClock(new Date(iso))
    return vnToIso(y, m, day, p?.h ?? 9, p?.min ?? 0)
}
