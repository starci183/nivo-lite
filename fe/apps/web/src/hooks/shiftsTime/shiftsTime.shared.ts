import { dayjs } from "@/modules/dayjs"

const ISO_DATE = "YYYY-MM-DD"

/** Minutes after midnight of an "HH:MM" clock time. */
export const clockMinutes = (time: string): number => {
    const match = /^(\d{1,2}):(\d{2})/.exec(time)
    return match === null ? 0 : Number(match[1]) * 60 + Number(match[2])
}

/** A "YYYY-MM-DD" date moved by whole days. */
export const isoAddDays = (date: string, days: number): string => dayjs.utc(date).add(days, "day").format(ISO_DATE)

/** The weekday of a date, 0 = Monday ... 6 = Sunday. */
export const isoWeekdayIndex = (date: string): number => (dayjs.utc(date).day() + 6) % 7

/** The seven dates of the week that starts on `monday`. */
export const isoWeekDates = (monday: string): Array<string> =>
    Array.from({ length: 7 }, (_, index) => isoAddDays(monday, index))

/** Whole days from the first date to the second. */
export const dayGap = (from: string, to: string): number => dayjs.utc(to).diff(dayjs.utc(from), "day")
