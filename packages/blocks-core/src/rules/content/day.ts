/** One calendar day in milliseconds. */
const DAY_MS = 86_400_000

/** A calendar day (`YYYY-MM-DD`) as a whole number of days since 1970-01-01. */
export const dayNumberOf = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00.000Z`) / DAY_MS)

/** The calendar day a day number stands for. */
export const dayOfNumber = (dayNumber: number): string => new Date(dayNumber * DAY_MS).toISOString().slice(0, 10)

/** The day `days` after a day (before, for a negative count). */
export const addDays = (day: string, days: number): string => dayOfNumber(dayNumberOf(day) + days)

/** The ISO weekday of a day: Monday 1 to Sunday 7. */
export const isoWeekdayOf = (day: string): number => new Date(`${day}T00:00:00.000Z`).getUTCDay() || 7

/** Whether a text is a real calendar day `YYYY-MM-DD`. */
export const isDay = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) && dayOfNumber(dayNumberOf(value)) === value

/** The last day of the month a day falls in. */
export const monthEndOf = (day: string): string => {
    const [year = 0, month = 1] = day.split("-").map(Number)
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/** The Monday of the week a day falls in. */
export const weekStartOf = (day: string): string => addDays(day, 1 - isoWeekdayOf(day))
