/** The periods the overview switches between; each reads the same data over a different window. */
export type OverviewPeriod = "today" | "last_7_days" | "last_30_days" | "this_month"

/** The periods in the order the switch lists them. */
export const OVERVIEW_PERIODS: readonly [OverviewPeriod, OverviewPeriod, OverviewPeriod, OverviewPeriod] = [
    "today",
    "last_7_days",
    "last_30_days",
    "this_month",
]

/** The period the page opens on. */
export const DEFAULT_PERIOD: OverviewPeriod = "last_7_days"

/** The address query that carries the period, so a view can be shared and survives a reload. */
export const PERIOD_PARAM = "period"

/** The short word each period wears in the address. */
const PERIOD_WORDS: Readonly<Record<OverviewPeriod, string>> = {
    today: "today",
    last_7_days: "7d",
    last_30_days: "30d",
    this_month: "month",
}

/** The address word of a period. */
export const periodWordOf = (period: OverviewPeriod): string => PERIOD_WORDS[period]

/** The period an address word names; any other word, or none, is the default. */
export const periodOfWord = (word: string | null): OverviewPeriod =>
    OVERVIEW_PERIODS.find((period) => PERIOD_WORDS[period] === word) ?? DEFAULT_PERIOD

/** Vietnam time has no daylight saving: UTC+7 all year. */
const VIETNAM_OFFSET_MS = 7 * 3_600_000

const DAY_MS = 86_400_000

/** The first and the last day a period covers, as the instant each day starts on the Vietnam clock. */
export interface PeriodRange {
    readonly first: Date
    readonly last: Date
}

/** The first and last day of a period, today being the last (the same windows the back end reads). */
export const rangeOfPeriod = (period: OverviewPeriod, now: Date): PeriodRange => {
    const local = new Date(now.getTime() + VIETNAM_OFFSET_MS)
    const today = new Date(Math.floor((now.getTime() + VIETNAM_OFFSET_MS) / DAY_MS) * DAY_MS - VIETNAM_OFFSET_MS)
    const spans: Readonly<Record<OverviewPeriod, Date>> = {
        today,
        last_7_days: new Date(today.getTime() - 6 * DAY_MS),
        last_30_days: new Date(today.getTime() - 29 * DAY_MS),
        this_month: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - VIETNAM_OFFSET_MS),
    }
    return { first: spans[period], last: today }
}
