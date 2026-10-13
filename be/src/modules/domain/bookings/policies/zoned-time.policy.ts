const MINUTE_MS = 60_000

const zonedFormatter = (timeZone: string): Intl.DateTimeFormat =>
    new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })

const FIELDS = ["year", "month", "day", "hour", "minute", "second"] as const

const isField = (type: string): type is (typeof FIELDS)[number] => FIELDS.some((field) => field === type)

/** The wall-clock fields of an instant in a time zone. */
const partsOf = (ms: number, timeZone: string) => {
    const found = { year: 0, month: 0, day: 0, hour: 0, minute: 0, second: 0 }
    for (const part of zonedFormatter(timeZone).formatToParts(new Date(ms))) {
        if (isField(part.type)) found[part.type] = Number(part.value)
    }
    return found
}

/** The year, month and day numbers of a `YYYY-MM-DD`. */
const dayNumbers = (date: string) => ({
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
})

/** The offset of the zone from UTC at an instant, in minutes. */
export const zoneOffsetMin = (ms: number, timeZone: string): number => {
    const p = partsOf(ms, timeZone)
    return Math.round(
        (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000) / MINUTE_MS,
    )
}

/** The instant of a wall-clock time (`2026-10-08`, `09:30`) in a zone; a reading skipped or repeated by a clock change settles on the later instant. */
export const zonedMs = (date: string, hhmm: string, timeZone: string): number => {
    const d = dayNumbers(date)
    const guess = Date.UTC(d.year, d.month - 1, d.day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)))
    const first = guess - zoneOffsetMin(guess, timeZone) * MINUTE_MS
    return guess - zoneOffsetMin(first, timeZone) * MINUTE_MS
}

/** `YYYY-MM-DD` of an instant in a zone. */
export const localDate = (ms: number, timeZone: string): string => {
    const p = partsOf(ms, timeZone)
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`
}

/** `HH:MM` of an instant in a zone. */
export const localHhmm = (ms: number, timeZone: string): string => {
    const p = partsOf(ms, timeZone)
    return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`
}

/** The ISO weekday of a `YYYY-MM-DD`: 1 is Monday and 7 is Sunday. */
export const isoWeekday = (date: string): number => {
    const d = dayNumbers(date)
    return ((new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay() + 6) % 7) + 1
}

/** The `YYYY-MM-DD` that is `days` after (or before, when negative) a `YYYY-MM-DD`. */
export const addDays = (date: string, days: number): string => {
    const d = dayNumbers(date)
    return new Date(Date.UTC(d.year, d.month - 1, d.day + days)).toISOString().slice(0, 10)
}

/** The Monday of the week that holds a `YYYY-MM-DD`. */
export const mondayOf = (date: string): string => addDays(date, 1 - isoWeekday(date))

/** The first five characters (`HH:MM`) of a database time such as `09:30:00`. */
export const hhmmOf = (time: string): string => time.slice(0, 5)

/** The ISO 8601 text of an instant. */
export const isoOf = (ms: number): string => new Date(ms).toISOString()
