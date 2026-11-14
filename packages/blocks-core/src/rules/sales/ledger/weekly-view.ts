import { z } from "zod"
import { moneyOf } from "./book-view"
import { WEEK_KEYS } from "./weekly"

const week = z.number().min(0)

/** The weeks the weekly read answers, judged by the parts the block draws; a record that does not fit is a failed read. */
export interface WeeklyRecord {
    /** Which period the weeks are of. */
    readonly periodKey: "this" | "last"
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
    /** The money received in each week. */
    readonly w1: number
    /** The second week. */
    readonly w2: number
    /** The third week. */
    readonly w3: number
    /** The fourth week. */
    readonly w4: number
    /** The fifth week, which only some months have. */
    readonly w5: number
}

/** The weekly record the read answers. */
export const weeklyRecord: z.ZodType<WeeklyRecord> = z.looseObject({
    periodKey: z.enum(["this", "last"]),
    fromDay: z
        .string()
        .length(10)
        .regex(/^\d{4}-\d{2}-\d{2}$/),
    w1: week,
    w2: week,
    w3: week,
    w4: week,
    w5: week,
})

/** One bar of the chart, as the Grammar chart takes it. */
export interface WeekBar {
    /** The key of the bar. */
    readonly id: string
    /** The week, `T1` to `T5`. */
    readonly label: string
    /** The money received, VND. */
    readonly value: number
    /** The money as dong. */
    readonly valueLabel: string
}

/** The month of a period written month/year (`11/2026`). */
export const monthOf = (fromDay: string): string => `${fromDay.slice(5, 7)}/${fromDay.slice(0, 4)}`

/** The bars of the weeks: four always, and the fifth only when something was received in it. */
export const weekBarsOf = (record: WeeklyRecord, weekWord: (position: number) => string): ReadonlyArray<WeekBar> =>
    WEEK_KEYS.flatMap((key, index) =>
        key === "w5" && record.w5 === 0
            ? []
            : [{ id: key, label: weekWord(index + 1), value: record[key], valueLabel: moneyOf(record[key]) }],
    )
