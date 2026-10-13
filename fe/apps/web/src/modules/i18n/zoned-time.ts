const MINUTE_MS = 60_000

/** The calendar fields of an instant on the wall clock of a time zone. */
interface WallClock {
    readonly year: number
    readonly month: number
    readonly day: number
    readonly hour: number
    readonly minute: number
    readonly second: number
}

const wallClockOf = (ms: number, timeZone: string): WallClock => {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(new Date(ms))
    const field = (type: Intl.DateTimeFormatPartTypes): number =>
        Number(parts.find((part) => part.type === type)?.value ?? 0)
    return {
        year: field("year"),
        month: field("month"),
        day: field("day"),
        hour: field("hour"),
        minute: field("minute"),
        second: field("second"),
    }
}

const offsetMinutes = (ms: number, timeZone: string): number => {
    const clock = wallClockOf(ms, timeZone)
    const wall = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
    return Math.round((wall - Math.floor(ms / 1000) * 1000) / MINUTE_MS)
}

const pad = (value: number): string => String(value).padStart(2, "0")

/** The `YYYY-MM-DD` date of an instant on the wall clock of a time zone. */
export const wallDate = (ms: number, timeZone: string): string => {
    const clock = wallClockOf(ms, timeZone)
    return `${clock.year}-${pad(clock.month)}-${pad(clock.day)}`
}

/** The minutes since local midnight of an instant on the wall clock of a time zone. */
export const wallMinutes = (ms: number, timeZone: string): number => {
    const clock = wallClockOf(ms, timeZone)
    return clock.hour * 60 + clock.minute
}

/** The `HH:MM` clock text of a count of minutes since midnight; 24:00 stays 24:00. */
export const wallClockText = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

/** The instant of a wall-clock time (`YYYY-MM-DD`, `HH:MM`) in a time zone. */
export const wallInstant = (date: string, clock: string, timeZone: string): number => {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
    const [hour = 0, minute = 0] = clock.split(":").map(Number)
    const guess = Date.UTC(year, month - 1, day, hour, minute)
    const first = guess - offsetMinutes(guess, timeZone) * MINUTE_MS
    return guess - offsetMinutes(first, timeZone) * MINUTE_MS
}

/** The ISO weekday of a `YYYY-MM-DD` date: 1 is Monday and 7 is Sunday. */
export const isoDayNumber = (date: string): number => {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    return weekday === 0 ? 7 : weekday
}

/** The `YYYY-MM-DD` date `days` after a date (before it when negative). */
export const shiftDate = (date: string, days: number): string => {
    const [year = 0, month = 1, day = 1] = date.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** The Monday of the week a `YYYY-MM-DD` date falls in. */
export const weekStartOf = (date: string): string => shiftDate(date, 1 - isoDayNumber(date))

/** The `YYYY-MM-DD` date of this moment on the wall clock of a time zone. */
export const wallToday = (timeZone: string): string => wallDate(Date.now(), timeZone)
