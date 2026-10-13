import { dayjs } from "@/modules/dayjs"

/** Client-safe estimates of the credits page; the back end determines every charge. */

interface RunoutInput {
    readonly remaining: number
    readonly last7Credits: number
    readonly today: string
}

const addDays = (day: string, n: number): string => dayjs.utc(`${day}T00:00:00Z`).add(n, "day").format("YYYY-MM-DD")

/**
 * The date (YYYY-MM-DD, Vietnam calendar) this month's allowance runs out at the average daily burn of the last 7 days, or null
 * when it does not run out this month (no recent use, already used up, or the date falls in a later month).
 */
export const forecastRunout = (a: RunoutInput): string | null => {
    const avg = a.last7Credits / 7
    if (!(a.remaining > 0) || !(avg > 0)) return null
    const date = addDays(a.today, Math.floor(a.remaining / avg))
    return date.slice(0, 7) === a.today.slice(0, 7) ? date : null
}
