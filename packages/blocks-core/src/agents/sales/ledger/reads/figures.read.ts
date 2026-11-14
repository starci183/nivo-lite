import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { figuresOf, type AccountingFigures } from "../rules/figures"
import { periodOf, type PeriodKey } from "../rules/period"
import { bookTotals, openInvoices, unmatchedIn } from "../accounting-data"
import { BOOK, INVOICES, TRANSACTIONS } from "../ports"
import { periodVariables as variables } from "./period-variables"

/** The most open invoices the receivable and the ageing add up. */
export const OPEN_INVOICES_MAX = 1_000

/** The figures of one period with the days it spans. */
export interface FiguresView extends AccountingFigures {
    /** Which period the figures are for. */
    readonly periodKey: PeriodKey
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
    /** The first day after the period, `YYYY-MM-DD`. */
    readonly toDay: string
}

/** `blocks-core.sales.api.entry.figures`: money received, invoiced, corrected and still owed in a period, with the unmatched payments and the ageing. */
export const figuresRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.entry.figures",
    dataKind: "accounting-figures",
    shape: "record",
    fields: ["periodKey", "fromDay", "toDay", "income", "invoiced", "adjustments", "unmatched", "receivable", "ageing"],
    paths: {},
    variables,
    permission: "sales.view",
    ports: { book: BOOK, transactions: TRANSACTIONS, invoices: INVOICES },
    run: async ({ book, transactions, invoices }, given, context): Promise<FiguresView> => {
        const period = periodOf(context.now, given.period ?? "this")
        const [totals, unmatched, open] = await Promise.all([
            bookTotals(book, period),
            unmatchedIn(transactions, period),
            openInvoices(invoices, OPEN_INVOICES_MAX),
        ])
        return {
            periodKey: period.key,
            fromDay: period.fromDay,
            toDay: period.toDay,
            ...figuresOf({ totals, unmatched, openInvoices: open, now: context.now }),
        }
    },
})
