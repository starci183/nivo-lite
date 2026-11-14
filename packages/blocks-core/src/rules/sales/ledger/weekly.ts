const DAY_MS = 86_400_000
const WEEK_DAYS = 7

/** The weeks of a month the bars show: a month holds at most five. */
export const WEEK_KEYS: readonly ["w1", "w2", "w3", "w4", "w5"] = ["w1", "w2", "w3", "w4", "w5"]

/** The money received in each week of a period, VND. */
export type WeeklyIncome = Readonly<Record<(typeof WEEK_KEYS)[number], number>>

/** The part of an income entry the weeks add up. */
export interface IncomeEntry {
    /** The shop day of the entry, `YYYY-MM-DD`. */
    readonly entryDate: string
    /** The amount, VND. */
    readonly amountVnd: number
}

/** The income of each week of the period that starts on `fromDay` and ends before `toDay`; an entry outside the period adds to nothing. */
export const weeklyIncomeOf = (entries: ReadonlyArray<IncomeEntry>, fromDay: string, toDay: string): WeeklyIncome => {
    const from = Date.parse(fromDay)
    const inPeriod = entries.filter((entry) => entry.entryDate >= fromDay && entry.entryDate < toDay)
    const weekOf = (entry: IncomeEntry): number =>
        Math.min(Math.floor((Date.parse(entry.entryDate) - from) / DAY_MS / WEEK_DAYS), WEEK_KEYS.length - 1)
    const moneyOf = (week: number): number =>
        inPeriod.reduce((sum, entry) => (weekOf(entry) === week ? sum + entry.amountVnd : sum), 0)
    return { w1: moneyOf(0), w2: moneyOf(1), w3: moneyOf(2), w4: moneyOf(3), w5: moneyOf(4) }
}
