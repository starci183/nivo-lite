import { z } from "zod"
import { MAX_ENTRIES, MAX_ID } from "../../bounds"
import { dayOf, moneyOf } from "./book-view"
import type { DueItem } from "./due-soon"

const measure = z.looseObject({ vnd: z.number(), count: z.number() })
const ageingBucket = z.looseObject({ count: z.number() })

/** A sum of money and how many entries or invoices it is made of. */
export interface FigureMeasure {
    /** The money, in VND. */
    readonly vnd: number
    /** How many. */
    readonly count: number
}

/** How many open invoices fall in one age bucket. */
export interface AgeingBucket {
    /** How many. */
    readonly count: number
}

/** The open invoices by age. */
export interface FigureAgeing {
    /** Not yet overdue. */
    readonly d0: AgeingBucket
    /** Overdue up to 30 days. */
    readonly d30: AgeingBucket
    /** Overdue 60 days or more. */
    readonly d60: AgeingBucket
}

/** The figures of a period as the figures read answers them, judged by the parts the overview draws. */
export interface FiguresRecord {
    /** Which period the figures are for. */
    readonly periodKey: "this" | "last"
    /** Money received, and how many entries. */
    readonly income: FigureMeasure
    /** Money still owed, and how many invoices. */
    readonly receivable: FigureMeasure
    /** Payments nobody tied to anything. */
    readonly unmatched: FigureMeasure
    /** The open invoices by age. */
    readonly ageing: FigureAgeing
}

/** The figures the overview draws; a record that does not fit is a failed read. */
export const figuresRecord: z.ZodType<FiguresRecord> = z.looseObject({
    periodKey: z.enum(["this", "last"]),
    income: measure,
    receivable: measure,
    unmatched: measure,
    ageing: z.looseObject({ d0: ageingBucket, d30: ageingBucket, d60: ageingBucket }),
})

/** The words of the four cells, with `{count}` and `{amount}` where the number goes. */
export interface FigureWords {
    /** The term of the income cell for this month, and for last month. */
    readonly incomeTerm: Readonly<Record<"this" | "last", string>>
    /** The line under the income. */
    readonly incomeHint: string
    /** The term of the receivable cell. */
    readonly receivableTerm: string
    /** The line under the receivable; takes `{count}`. */
    readonly receivableHint: string
    /** The term of the unmatched cell. */
    readonly unmatchedTerm: string
    /** The line under the unmatched; takes `{amount}`. */
    readonly unmatchedHint: string
    /** The term of the ageing cell. */
    readonly ageingTerm: string
    /** The line under the ageing. */
    readonly ageingHint: string
}

/** One cell of the strip. */
export interface FigureCell {
    /** The key of the cell. */
    readonly id: string
    /** What it measures. */
    readonly term: string
    /** The value. */
    readonly value: string
    /** The line under the value. */
    readonly hint: string
}

/** The four cells of the overview: income, receivable, money in that matched nothing, and the ageing as three counts. */
export const figureCellsOf = (figures: FiguresRecord, words: FigureWords): ReadonlyArray<FigureCell> => [
    {
        id: "income",
        term: words.incomeTerm[figures.periodKey],
        value: moneyOf(figures.income.vnd),
        hint: words.incomeHint,
    },
    {
        id: "receivable",
        term: words.receivableTerm,
        value: moneyOf(figures.receivable.vnd),
        hint: words.receivableHint.replaceAll("{count}", String(figures.receivable.count)),
    },
    {
        id: "unmatched",
        term: words.unmatchedTerm,
        value: String(figures.unmatched.count),
        hint: words.unmatchedHint.replaceAll("{amount}", moneyOf(figures.unmatched.vnd)),
    },
    {
        id: "ageing",
        term: words.ageingTerm,
        value: `${figures.ageing.d0.count} / ${figures.ageing.d30.count} / ${figures.ageing.d60.count}`,
        hint: words.ageingHint,
    },
]

/** The obligations the due-soon read answers. */
export interface DueRecord {
    /** The obligations, soonest first. */
    readonly rows: ReadonlyArray<DueItem>
}

/** The due-soon list; a record that does not fit is a failed read. */
export const dueRecord: z.ZodType<DueRecord> = z.looseObject({
    rows: z
        .array(
            z.looseObject({
                id: z.string().min(1).max(MAX_ID),
                kind: z.enum(["vat", "pit"]),
                unit: z.enum(["month", "quarter"]),
                period: z.number().int().min(1).max(12),
                dueDay: z.string().max(MAX_ID),
                daysLeft: z.number().int(),
            }),
        )
        .max(MAX_ENTRIES),
})

/** The words of the due-soon rows; `{period}`, `{date}` and `{count}` mark where the number goes. */
export interface DueWords {
    /** The title of the value added tax by month and by quarter, and of the personal income tax; each takes `{period}`. */
    readonly title: Readonly<Record<"vatMonth" | "vatQuarter" | "pit", string>>
    /** The line under the title; takes `{date}`. */
    readonly due: string
    /** The chip while days are left; takes `{count}`. */
    readonly left: string
    /** The chip on the day itself. */
    readonly today: string
}

/** One row of the due-soon list. */
export interface DueRow {
    /** The key of the row. */
    readonly id: string
    /** The tax and the month it is for. */
    readonly title: string
    /** When it falls due. */
    readonly description: string
    /** How long is left. */
    readonly chip: string
}

/** The date of a `YYYY-MM-DD` day written day/month/year. */
const dateOf = (day: string): string => `${dayOf(day)}/${day.slice(0, 4)}`

/** Which title a row takes: the value added tax by month or by quarter, or the personal income tax. */
const titleKeyOf = (item: DueItem): "vatMonth" | "vatQuarter" | "pit" => {
    if (item.kind === "pit") return "pit"
    return item.unit === "quarter" ? "vatQuarter" : "vatMonth"
}

/** The rows of the due-soon list in the words of the viewer. */
export const dueRowsOf = (items: ReadonlyArray<DueItem>, words: DueWords): ReadonlyArray<DueRow> =>
    items.map((item) => ({
        id: item.id,
        title: words.title[titleKeyOf(item)].replaceAll("{period}", String(item.period)),
        description: words.due.replaceAll("{date}", dateOf(item.dueDay)),
        chip: item.daysLeft === 0 ? words.today : words.left.replaceAll("{count}", String(item.daysLeft)),
    }))

/** The words of the ageing: the title with the number of open invoices, and each bucket with its count; each takes `{count}`. */
export interface AgeingWords {
    /** The bucket names, from the youngest to the oldest. */
    readonly buckets: readonly [string, string, string]
    /** The line after the title; takes `{count}`. */
    readonly total: string
    /** The count written under a bucket; takes `{count}`. */
    readonly count: string
}

/** The open invoices by age: how many there are in all, and one gauge per bucket. */
export interface Ageing {
    /** The suffix of the title with the number of open invoices. */
    readonly total: string
    /** The gauges, sharing the sum of the counts. */
    readonly points: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly value: number
        readonly valueLabel: string
    }>
}

/** The ageing of the open invoices drawn from the figures: three gauges on the scale of their sum. */
export const ageingOf = (figures: FiguresRecord, words: AgeingWords): Ageing => {
    const counts: readonly [number, number, number] = [
        figures.ageing.d0.count,
        figures.ageing.d30.count,
        figures.ageing.d60.count,
    ]
    const sum = counts.reduce((total, count) => total + count, 0)
    return {
        total: words.total.replaceAll("{count}", String(sum)),
        points: counts.map((count, index) => ({
            id: `d${index}`,
            label: words.buckets[index] ?? "",
            value: count,
            valueLabel: words.count.replaceAll("{count}", String(count)),
        })),
    }
}
