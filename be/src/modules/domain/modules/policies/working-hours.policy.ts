import { parseJsonText } from "@modules/platform/primitives"

/**
 * The weekly working hours of an agent, as the owner sets them on the agent's settings and the web keeps them: the JSON text
 * `{"v":1,"afterHours":true,"days":[[["08:00","20:00"]],...]}` with seven days, Monday first, each a list of `[from, to]` ranges in the
 * workspace's time zone (`to` exclusive), and `afterHours` the "answer after hours" choice: true answers customers at any hour.
 */

/** The days of a week, Monday first. */
const WEEK_DAYS = 7

/** The most ranges one day holds. */
const RANGES_MAX = 12

const MINUTES_PER_DAY = 24 * 60

const MS_PER_MINUTE = 60_000

/** One stretch of duty in a day, minutes since midnight; `end` is exclusive. */
export interface DutyRange {
    /** The first minute. */
    readonly start: number
    /** The minute it ends at, exclusive. */
    readonly end: number
}

/** The hours of an agent, read. */
export interface WorkingHours {
    /** Whether the agent answers customers outside its hours too. */
    readonly afterHours: boolean
    /** The ranges of each day, Monday first, merged and in order. */
    readonly days: ReadonlyArray<ReadonlyArray<DutyRange>>
}

/** The hours, or null when there are none. */
export type OptionalWorkingHours = WorkingHours | null

/** A moment, or null when there is none. */
export type OptionalMoment = Date | null

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The minutes of an `HH:mm` clock; 24:00 is the end of the day; null for anything else. */
const minutesOf = (clock: unknown): number | null => {
    if (typeof clock !== "string") return null
    const match = /^(\d{1,2}):(\d{2})$/u.exec(clock.trim())
    if (match === null) return null
    const hours = Number(match[1])
    const minutes = Number(match[2])
    if (hours === 24 && minutes === 0) return MINUTES_PER_DAY
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
}

const clockOf = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** The ranges of one day, merged and in order; null when an entry is not a range. */
const dayOf = (day: unknown): ReadonlyArray<DutyRange> | null => {
    if (!Array.isArray(day) || day.length > RANGES_MAX) return null
    const ranges: Array<DutyRange> = []
    for (const pair of day) {
        if (!Array.isArray(pair) || pair.length !== 2) return null
        const start = minutesOf(pair[0])
        const end = minutesOf(pair[1])
        if (start === null || end === null || end <= start) return null
        ranges.push({ start, end })
    }
    const sorted = ranges.toSorted((left, right) => left.start - right.start)
    return sorted.reduce<Array<DutyRange>>((merged, range) => {
        const last = merged.at(-1)
        if (last !== undefined && range.start <= last.end)
            merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) }
        else merged.push(range)
        return merged
    }, [])
}

/** The hours a stored value holds (the JSON text, or the object it parses to); null when it is not the saved shape. */
export const workingHoursOf = (value: unknown): OptionalWorkingHours => {
    const read = typeof value === "string" ? parseJsonText(value) : { ok: true as const, value }
    const raw: unknown = read.ok ? read.value : null
    if (!isRecord(raw) || raw.v !== 1 || !Array.isArray(raw.days) || raw.days.length !== WEEK_DAYS) return null
    const days = raw.days.map((day) => dayOf(day))
    if (days.includes(null)) return null
    return { afterHours: raw.afterHours !== false, days: days.flatMap((day) => (day === null ? [] : [day])) }
}

/** The hours as the setting keeps them: the same JSON text the web stores. */
export const workingHoursTextOf = (hours: WorkingHours): string =>
    JSON.stringify({
        v: 1,
        afterHours: hours.afterHours,
        days: hours.days.map((day) => day.map((range) => [clockOf(range.start), clockOf(range.end)])),
    })

/** The weekday (Monday 0) and the minute of a moment in a time zone. */
/** Where a moment falls in a week of a time zone. */
interface LocalMinute {
    /** The weekday, Monday 0. */
    readonly day: number
    /** The minute of that day. */
    readonly minute: number
}

const localOf = (at: Date, timeZone: string): LocalMinute => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(at)
    const part = (type: string): string => parts.find((each) => each.type === type)?.value ?? ""
    const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(part("weekday"))
    return { day: Math.max(0, day), minute: Number(part("hour")) * 60 + Number(part("minute")) }
}

/** Whether the agent is on duty at a moment. */
export const onDutyAt = (hours: WorkingHours, at: Date, timeZone: string): boolean => {
    const { day, minute } = localOf(at, timeZone)
    return (hours.days[day] ?? []).some((range) => minute >= range.start && minute < range.end)
}

/**
 * The next moment the agent comes on duty after `at`, to the minute; null when the week holds no hour at all. Read in minutes from the
 * local clock of `at`, so it is exact in a zone without daylight saving and off by the shift only across one.
 */
export const nextOnDutyAt = (
    hours: WorkingHours,
    at: Date,
    timeZone: string,
): OptionalMoment => {
    const { day, minute } = localOf(at, timeZone)
    for (let ahead = 0; ahead <= WEEK_DAYS; ahead += 1) {
        const ranges = hours.days[(day + ahead) % WEEK_DAYS] ?? []
        const start = ranges.find((range) => ahead > 0 || range.start > minute)?.start
        if (start !== undefined) {
            const minutes = ahead * MINUTES_PER_DAY + start - minute
            return new Date(Math.floor(at.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE + minutes * MS_PER_MINUTE)
        }
    }
    return null
}

/** Whether a customer who writes at `at` waits for the agent's hours: the agent keeps hours, does not answer after them, and is off duty. */
export const holdsCustomerAt = (
    hours: OptionalWorkingHours,
    at: Date,
    timeZone: string,
): boolean =>
    hours !== null && !hours.afterHours && hours.days.some((day) => day.length > 0) && !onDutyAt(hours, at, timeZone)
