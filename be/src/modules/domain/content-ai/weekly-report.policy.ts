import type { BestDay, EngagementDay, ReportMetric, WeekBounds, MarketingWeeklyReport } from "./content-agent.contracts"

const DAY_MS = 86_400_000
/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000

const dayText = (time: number): string => new Date(time).toISOString().slice(0, 10)

/** The Monday (Vietnam time) of the last complete week before `now`, as `YYYY-MM-DD`. */
export const lastWeekStart = (now: Date): string => {
    const local = new Date(now.getTime() + VN_OFFSET_MS)
    const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    const sinceMonday = (local.getUTCDay() + 6) % 7
    return dayText(today - (sinceMonday + 7) * DAY_MS)
}

/** The days of the week that starts on `weekStart`, Monday first. */
export const weekDays = (weekStart: string): ReadonlyArray<string> => {
    const start = Date.parse(`${weekStart}T00:00:00.000Z`)
    return Array.from({ length: 7 }, (_, index) => dayText(start + index * DAY_MS))
}

/** The first day after the week, `YYYY-MM-DD`, and the first day of the week before. */
export const weekBounds = (weekStart: string): WeekBounds => {
    const start = Date.parse(`${weekStart}T00:00:00.000Z`)
    return { previousStart: dayText(start - 7 * DAY_MS), nextStart: dayText(start + 7 * DAY_MS) }
}

const metricOf = (value: number, previous: number): ReportMetric => ({
    value,
    previous,
    changePct: previous === 0 ? null : Math.round(((value - previous) / previous) * 100),
})

const sum = (rows: ReadonlyArray<EngagementDay>, pick: (row: EngagementDay) => number): number =>
    rows.reduce((total, row) => total + pick(row), 0)

/** The report of the week starting `weekStart` from the daily rows of that week and the week before (other rows are ignored). */
export const weeklyReportOf = (weekStart: string, rows: ReadonlyArray<EngagementDay>): MarketingWeeklyReport => {
    const days = weekDays(weekStart)
    const previousDays = new Set(weekDays(weekBounds(weekStart).previousStart))
    const current = rows.filter((row) => days.includes(row.day))
    const previous = rows.filter((row) => previousDays.has(row.day))
    const channels = [...new Set(current.map((row) => row.channel))].sort((a, b) => a.localeCompare(b))
    return {
        weekStart,
        weekEnd: dayText(Date.parse(`${weekStart}T00:00:00.000Z`) + 6 * DAY_MS),
        reach: metricOf(
            sum(current, (row) => row.reach),
            sum(previous, (row) => row.reach),
        ),
        engagements: metricOf(
            sum(current, (row) => row.engagements),
            sum(previous, (row) => row.engagements),
        ),
        messages: metricOf(
            sum(current, (row) => row.messages),
            sum(previous, (row) => row.messages),
        ),
        days: days.map((day) => {
            const values = channels.map((channel) => ({
                channel,
                value: sum(
                    current.filter((row) => row.day === day && row.channel === channel),
                    (row) => row.engagements,
                ),
            }))
            return {
                day,
                byChannel: Object.fromEntries(values.map((entry) => [entry.channel, entry.value])),
                channels: values,
            }
        }),
        channels,
    }
}

/** The channel and day of the week's best engagement, or null when nothing engaged. */
export const bestDayOf = (report: MarketingWeeklyReport): BestDay | null => {
    let best: BestDay | null = null
    let bestValue = 0
    for (const day of report.days) {
        for (const [channel, value] of Object.entries(day.byChannel)) {
            if (value > bestValue) {
                best = { day: day.day, channel }
                bestValue = value
            }
        }
    }
    return best
}
