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
    const totals: [number, number, number, number, number] = [0, 0, 0, 0, 0]
    const from = Date.parse(fromDay)
    for (const entry of entries) {
        if (entry.entryDate < fromDay || entry.entryDate >= toDay) continue
        const week = Math.min(
            Math.floor((Date.parse(entry.entryDate) - from) / DAY_MS / WEEK_DAYS),
            WEEK_KEYS.length - 1,
        )
        totals[week] = (totals[week] ?? 0) + entry.amountVnd
    }
    return { w1: totals[0], w2: totals[1], w3: totals[2], w4: totals[3], w5: totals[4] }
}
