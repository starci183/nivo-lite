import type { BookEntryKind } from "./accounting.types"
import { DAY_MS } from "./shop-time"

/** Days after which an open invoice moves from the first ageing bucket to the second. */
export const AGEING_FIRST_DAYS = 30

/** Days after which an open invoice moves from the second ageing bucket to the third. */
export const AGEING_SECOND_DAYS = 60

/** A sum of money and how many things it adds up. */
export interface Measure {
    /** The money, in VND. */
    readonly vnd: number
    /** How many records it adds up. */
    readonly count: number
}

/** The sum of the book entries of one kind in a period. */
export interface KindTotal {
    /** The kind of entry. */
    readonly kind: BookEntryKind
    /** The money, in VND. */
    readonly vnd: number
    /** How many entries. */
    readonly count: number
}

/** The part of an open invoice the ageing reads. */
export interface OpenInvoice {
    /** The amount owed, in VND. */
    readonly amountVnd: number
    /** When it falls due, ISO text. */
    readonly dueAt: string | null
    /** When it was issued, ISO text. */
    readonly issuedAt: string | null
    /** When it was created, ISO text. */
    readonly createdAt: string
}

/** The open invoices by how old they are. */
export interface Ageing {
    /** Up to 30 days. */
    readonly d0: Measure
    /** 31 to 60 days. */
    readonly d30: Measure
    /** Over 60 days. */
    readonly d60: Measure
}

/** The figures the Accounting workbench opens with. */
export interface AccountingFigures {
    /** Money received in the period. */
    readonly income: Measure
    /** What was invoiced in the period. */
    readonly invoiced: Measure
    /** Corrections recorded in the period; their money is the corrected amounts. */
    readonly adjustments: Measure
    /** Payments of the period nobody tied to what they paid. */
    readonly unmatched: Measure
    /** Every open invoice, whatever the period. */
    readonly receivable: Measure
    /** The open invoices by age. */
    readonly ageing: Ageing
}

/** What the figures are built from. */
export interface FiguresInput {
    /** The book entries of the period, summed by kind (a kind with no entry may be absent). */
    readonly totals: ReadonlyArray<KindTotal>
    /** The payments of the period not tied to what they paid. */
    readonly unmatched: Measure
    /** Every invoice that is issued and not paid. */
    readonly openInvoices: ReadonlyArray<OpenInvoice>
    /** The instant of the read. */
    readonly now: Date
}

const NONE: Measure = { vnd: 0, count: 0 }

const add = (measure: Measure, vnd: number): Measure => ({ vnd: measure.vnd + vnd, count: measure.count + 1 })

const totalOf = (totals: ReadonlyArray<KindTotal>, kind: BookEntryKind): Measure => {
    const found = totals.filter((total) => total.kind === kind)
    return found.reduce((sum, total) => ({ vnd: sum.vnd + total.vnd, count: sum.count + total.count }), NONE)
}

/** The bucket an open invoice of this many days falls into. */
export const ageingSlotOf = (days: number): keyof Ageing => {
    if (days > AGEING_SECOND_DAYS) return "d60"
    return days > AGEING_FIRST_DAYS ? "d30" : "d0"
}

/** Every open invoice by how old it is since it fell due (or was issued). */
export const ageingOf = (invoices: ReadonlyArray<OpenInvoice>, now: Date): Ageing => {
    const slots: Record<keyof Ageing, Measure> = { d0: NONE, d30: NONE, d60: NONE }
    for (const invoice of invoices) {
        const since = Date.parse(invoice.dueAt ?? invoice.issuedAt ?? invoice.createdAt)
        const days = Number.isFinite(since) ? Math.floor((now.getTime() - since) / DAY_MS) : 0
        const slot = ageingSlotOf(days)
        slots[slot] = add(slots[slot], invoice.amountVnd)
    }
    return slots
}

/** The figures of one period from the sums of its book entries, its unmatched payments and the open invoices. */
export const figuresOf = (input: FiguresInput): AccountingFigures => ({
    income: totalOf(input.totals, "income"),
    invoiced: totalOf(input.totals, "invoice"),
    adjustments: totalOf(input.totals, "adjustment"),
    unmatched: input.unmatched,
    receivable: input.openInvoices.reduce((sum, invoice) => add(sum, invoice.amountVnd), NONE),
    ageing: ageingOf(input.openInvoices, input.now),
})
