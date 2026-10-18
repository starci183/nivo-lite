import type { MonthBounds, WallClock } from "../shifts.contracts"

/** Minutes in a day. */
export const DAY_MIN = 1440

/** The grain coverage is measured in, in minutes. */
export const CELL_MIN = 30

/** Vietnam has no daylight saving: the shop's wall clock is UTC+7 all year. */
const VN_OFFSET_MIN = 7 * 60

const MS_PER_MIN = 60_000

const MS_PER_DAY = 86_400_000

const TIME_PATTERN = /^(\d{1,2}):(\d{2})/u

/** Minutes since midnight of an HH:MM or HH:MM:SS time; zero for text that is not a time. */
export const toMin = (hm: string): number => {
    const match = TIME_PATTERN.exec(hm)
    return match === null ? 0 : Number(match[1]) * 60 + Number(match[2])
}

/** The HH:MM text of a minute count. */
export const fromMin = (minutes: number): string =>
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`

/** Normalises a time to HH:MM (a database time arrives as HH:MM:SS). */
export const hhmm = (time: string): string => fromMin(toMin(time))

/** The day `count` days after (or before, when negative) a YYYY-MM-DD day. */
export const addDays = (day: string, count: number): string => {
    const moved = new Date(`${day}T00:00:00Z`)
    moved.setUTCDate(moved.getUTCDate() + count)
    return moved.toISOString().slice(0, 10)
}

/** The weekday of a YYYY-MM-DD day, 0 Monday to 6 Sunday. */
export const weekdayOf = (day: string): number => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7

/** The Monday of the week a day belongs to. */
export const mondayOf = (day: string): string => addDays(day, -weekdayOf(day))

/** The seven days of the week that starts on `monday`. */
export const weekDates = (monday: string): Array<string> =>
    Array.from({ length: 7 }, (_, index) => addDays(monday, index))

/** Whole days from `from` to `to`. */
export const dayDiff = (from: string, to: string): number =>
    Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY)

/** The shop-local wall clock (day and minute of the day) of an instant. */
export const clockVn = (now: Date): WallClock => {
    const local = new Date(now.getTime() + VN_OFFSET_MIN * MS_PER_MIN)
    return { date: local.toISOString().slice(0, 10), minute: local.getUTCHours() * 60 + local.getUTCMinutes() }
}

/** The shop-local day of an instant. */
export const todayVn = (now: Date): string => clockVn(now).date

/** The UTC instant of a shop-local day and minute. */
export const instantOf = (day: string, minute: number): Date =>
    new Date(Date.parse(`${day}T00:00:00Z`) + (minute - VN_OFFSET_MIN) * MS_PER_MIN)

/** The first and last day of a YYYY-MM month. */
export const monthRange = (month: string): MonthBounds => {
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate()
    return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` }
}

/** The YYYY-MM month before the month a day belongs to. */
export const previousMonth = (day: string): string => addDays(`${day.slice(0, 7)}-01`, -1).slice(0, 7)

/** The first day of the month after the month a day belongs to. */
export const nextMonthStart = (day: string): string => {
    const first = `${day.slice(0, 7)}-01`
    return `${addDays(first, 31).slice(0, 7)}-01`
}

/** The minutes between two HH:MM times of one day. */
export const spanMin = (start: string, end: string): number => toMin(end) - toMin(start)
