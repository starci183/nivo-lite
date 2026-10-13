import type { BookingHoursView } from "@/modules/types"

/** One weekly opening window as the database writer takes it. */
export interface HoursWindow {
    readonly weekday: number
    readonly start: string
    readonly end: string
}

const WINDOW = /^(\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?$/u
const OFF_WORDS: ReadonlyArray<string> = ["off", "closed"]

/** The seven days of a week, Monday first. */
export const WEEK = [1, 2, 3, 4, 5, 6, 7] as const

const clock = (hour: string | undefined, minute: string | undefined): string =>
    `${(hour ?? "0").padStart(2, "0")}:${minute ?? "00"}`

/** The text of one weekday's windows, such as `09:00-12:00, 13:00-18:00`; empty when the resource rests that day. */
export const hoursLineOf = (hours: ReadonlyArray<BookingHoursView>, resourceId: string, weekday: number): string =>
    hours
        .filter((row) => row.resourceId === resourceId && row.weekday === weekday)
        .sort((left, right) => left.start.localeCompare(right.start))
        .map((row) => `${row.start}-${row.end}`)
        .join(", ")

/** The windows a typed line names, an empty list for a rest day, or null when the line cannot be read. */
export const parseHoursLine = (
    line: string,
): ReadonlyArray<{ readonly start: string; readonly end: string }> | null => {
    const text = line.trim()
    if (text === "" || OFF_WORDS.includes(text.toLowerCase())) return []
    const windows: Array<{ readonly start: string; readonly end: string }> = []
    for (const part of text.split(/[,;]/u)) {
        const match = WINDOW.exec(part.trim())
        if (match === null) return null
        windows.push({ start: clock(match[1], match[2]), end: clock(match[3], match[4]) })
    }
    return windows
}

/** The windows of the seven typed lines, or the weekday whose line cannot be read. */
export const parseWeek = (
    lines: ReadonlyArray<string>,
): { readonly rows: ReadonlyArray<HoursWindow> } | { readonly badWeekday: number } => {
    const rows: Array<HoursWindow> = []
    for (const weekday of WEEK) {
        const parsed = parseHoursLine(lines[weekday - 1] ?? "")
        if (parsed === null) return { badWeekday: weekday }
        for (const window of parsed) rows.push({ weekday, ...window })
    }
    return { rows }
}
