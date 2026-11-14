import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../../bounds"
import { dayOf, moneyOf } from "./book-view"
import type { Ledger } from "./ledger"

const line = z.looseObject({
    id: z.string().min(1).max(MAX_ID),
    title: z.string().max(MAX_LINE),
    kind: z.enum(["income", "expense", "invoice", "reversal", "adjustment"]),
    inVnd: z.number(),
    outVnd: z.number(),
    balanceVnd: z.number(),
})

/** The cash book the ledger read answers, judged by the parts the block draws; a record that does not fit is a failed read. */
export const ledgerRecord: z.ZodType<Ledger> = z.looseObject({
    openingVnd: z.number(),
    inVnd: z.number(),
    outVnd: z.number(),
    closingVnd: z.number(),
    days: z
        .array(
            z.looseObject({
                day: z.string().max(MAX_ID),
                lines: z.array(line).max(MAX_ENTRIES),
                inVnd: z.number(),
                outVnd: z.number(),
                balanceVnd: z.number(),
            }),
        )
        .max(MAX_ENTRIES),
})

/** The words of the band at the top of the book. */
export interface BandWords {
    /** The balance brought forward. */
    readonly opening: string
    /** The money in over the period. */
    readonly income: string
    /** The money out over the period. */
    readonly expense: string
    /** The balance carried forward. */
    readonly closing: string
}

/** One cell of the band. */
export interface BandCell {
    /** The key of the cell. */
    readonly id: string
    /** What it measures. */
    readonly term: string
    /** The amount, written as Vietnamese dong. */
    readonly value: string
}

/** The opening balance, the money in, the money out and the closing balance of the period. */
export const bandOf = (ledger: Ledger, words: BandWords): ReadonlyArray<BandCell> => [
    { id: "opening", term: words.opening, value: moneyOf(ledger.openingVnd) },
    { id: "in", term: words.income, value: moneyOf(ledger.inVnd) },
    { id: "out", term: words.expense, value: moneyOf(ledger.outVnd) },
    { id: "closing", term: words.closing, value: moneyOf(ledger.closingVnd) },
]

/** One line of a day as it is drawn: what it is, the money in and out (empty when none) and the balance after it. */
export interface LedgerRow {
    /** The key of the row. */
    readonly id: string
    /** What the entry is called, or its kind when it has no name. */
    readonly title: string
    /** The money in; empty when the line took none. */
    readonly income: string
    /** The money out; empty when the line paid none. */
    readonly expense: string
    /** The balance after the line. */
    readonly balance: string
}

/** One day of the book as it is drawn. */
export interface LedgerSection {
    /** The day, written day then month. */
    readonly day: string
    /** The lines of the day. */
    readonly rows: ReadonlyArray<LedgerRow>
    /** The balance at the end of the day. */
    readonly balance: string
}

const amount = (vnd: number): string => (vnd === 0 ? "" : moneyOf(vnd))

/** The days of the book with their lines; a line with no name is called by the word for its kind. */
export const sectionsOf = (ledger: Ledger, kindWord: (kind: string) => string): ReadonlyArray<LedgerSection> =>
    ledger.days.map((day) => ({
        day: dayOf(day.day),
        balance: moneyOf(day.balanceVnd),
        rows: day.lines.map((each) => ({
            id: each.id,
            title: each.title === "" ? kindWord(each.kind) : each.title,
            income: amount(each.inVnd),
            expense: amount(each.outVnd),
            balance: moneyOf(each.balanceVnd),
        })),
    }))
