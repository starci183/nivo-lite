import { z } from "zod"
import { MAX_ENTRIES, MAX_ID } from "../../bounds"
import { dayOf, moneyOf } from "./book-view"
import type { DueItem } from "./due-soon"

const measure = z.looseObject({ vnd: z.number(), count: z.number() })
const ageingBucket = z.looseObject({ count: z.number() })

/** The figures of a period as the figures read answers them, judged by the parts the overview draws. */
export interface FiguresRecord {
    /** Which period the figures are for. */
    readonly periodKey: "this" | "last"
    /** Money received, and how many entries. */
    readonly income: { readonly vnd: number; readonly count: number }
    /** Money still owed, and how many invoices. */
    readonly receivable: { readonly vnd: number; readonly count: number }
    /** Payments nobody tied to anything. */
    readonly unmatched: { readonly vnd: number; readonly count: number }
    /** The open invoices by age. */
    readonly ageing: {
        readonly d0: { readonly count: number }
        readonly d30: { readonly count: number }
        readonly d60: { readonly count: number }
    }
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
                month: z.number().int().min(1).max(12),
                dueDay: z.string().max(MAX_ID),
                daysLeft: z.number().int(),
            }),
        )
        .max(MAX_ENTRIES),
})

/** The words of the due-soon rows; `{month}`, `{date}` and `{count}` mark where the number goes. */
export interface DueWords {
    /** The title of each tax; takes `{month}`. */
    readonly title: Readonly<Record<"vat" | "pit", string>>
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

/** The rows of the due-soon list in the words of the viewer. */
export const dueRowsOf = (items: ReadonlyArray<DueItem>, words: DueWords): ReadonlyArray<DueRow> =>
    items.map((item) => ({
        id: item.id,
        title: words.title[item.kind].replaceAll("{month}", String(item.month)),
        description: words.due.replaceAll("{date}", dateOf(item.dueDay)),
        chip: item.daysLeft === 0 ? words.today : words.left.replaceAll("{count}", String(item.daysLeft)),
    }))
