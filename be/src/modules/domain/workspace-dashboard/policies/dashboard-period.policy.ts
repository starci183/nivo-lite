import type { DashboardDay, DashboardPeriod, DashboardWindow } from "../workspace-dashboard.contracts"

const HOUR_MS = 3_600_000
const DAY_MS = 24 * HOUR_MS

/** Vietnam time has no daylight saving: UTC+7 all year. */
const VIETNAM_OFFSET_MS = 7 * HOUR_MS

/** The fewest days the chart draws, whatever the period (a single day is no chart). */
const CHART_MIN_DAYS = 7

/** The first instant of the Vietnam day that holds `at`. */
export const startOfVietnamDay = (at: Date): Date =>
    new Date(Math.floor((at.getTime() + VIETNAM_OFFSET_MS) / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS)

/** The calendar day (YYYY-MM-DD) in Vietnam time of a day's first instant. */
export const dayKeyOf = (dayStart: Date): string =>
    new Date(dayStart.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10)

/** The first instant of the Vietnam month that holds `at`. */
const startOfVietnamMonth = (at: Date): Date => {
    const local = new Date(at.getTime() + VIETNAM_OFFSET_MS)
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - VIETNAM_OFFSET_MS)
}

/** The first instant of the period asked, the last day of which is today (Vietnam time). */
const periodStart = (period: DashboardPeriod, todayStart: Date): Date => {
    if (period === "today") return todayStart
    if (period === "last_7_days") return new Date(todayStart.getTime() - 6 * DAY_MS)
    if (period === "last_30_days") return new Date(todayStart.getTime() - 29 * DAY_MS)
    return startOfVietnamMonth(todayStart)
}

/** The days from `first` up to `to`, each as its Vietnam day. */
const daysBetween = (first: Date, to: Date): ReadonlyArray<DashboardDay> => {
    const count = Math.max(0, Math.round((to.getTime() - first.getTime()) / DAY_MS))
    return Array.from({ length: count }, (_, index) => {
        const from = new Date(first.getTime() + index * DAY_MS)
        return { day: dayKeyOf(from), from, to: new Date(from.getTime() + DAY_MS) }
    })
}

/**
 * The window of a period: it ends with today (Vietnam time), the period before has the same length, and the chart draws the period's
 * days, at least the last seven.
 */
export const windowOf = (period: DashboardPeriod, now: Date): DashboardWindow => {
    const todayStart = startOfVietnamDay(now)
    const to = new Date(todayStart.getTime() + DAY_MS)
    const from = periodStart(period, todayStart)
    const chartFrom = new Date(Math.min(from.getTime(), to.getTime() - CHART_MIN_DAYS * DAY_MS))
    return {
        period,
        from,
        to,
        previousFrom: new Date(from.getTime() - (to.getTime() - from.getTime())),
        days: daysBetween(chartFrom, to),
    }
}

/** The days split into runs of at most `size`, in order: one statement can hold only so many per-day measures. */
export const chunksOf = <T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> =>
    Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))
