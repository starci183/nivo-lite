import { addDays, dayStartMs, localDate } from "@modules/domain/workspace-settings"
import type { DashboardPeriod, DashboardWindow } from "../workspace-dashboard.contracts"

/** The first period day of the period asked (YYYY-MM-DD), the last day of which is `today`. */
const periodFirstDay = (period: DashboardPeriod, today: string): string => {
    if (period === "today") return today
    if (period === "last_7_days") return addDays(today, -6)
    if (period === "last_30_days") return addDays(today, -29)
    return `${today.slice(0, 7)}-01`
}

/**
 * The window of a period: it ends with today (in the workspace's time zone) and the period before has the same length.
 */
export const windowOf = (period: DashboardPeriod, now: Date, timeZone: string): DashboardWindow => {
    const today = localDate(now.getTime(), timeZone)
    const end = addDays(today, 1)
    const firstDay = periodFirstDay(period, today)
    const from = new Date(dayStartMs(firstDay, timeZone))
    const to = new Date(dayStartMs(end, timeZone))
    return {
        period,
        from,
        to,
        previousFrom: new Date(from.getTime() - (to.getTime() - from.getTime())),
    }
}
