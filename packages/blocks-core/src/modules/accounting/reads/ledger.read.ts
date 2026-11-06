import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { LEDGER_EPOCH_DAY, ledgerOf, openingOf } from "../../../rules/accounting/ledger"
import type { Ledger } from "../../../rules/accounting/ledger"
import { periodOf } from "../../../rules/accounting/period"
import type { PeriodKey } from "../../../rules/accounting/period"
import { bookEntriesPort } from "../ports"
import { periodVariables as variables } from "./period-variables"

/** The cash book of one period with the days it spans. */
export interface LedgerView extends Ledger {
    /** Which period the book is for. */
    readonly periodKey: PeriodKey
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
    /** The first day after the period, `YYYY-MM-DD`. */
    readonly toDay: string
}

/**
 * `accounting.ledger`: the cash book (so quy) of a period: what the entries before it left as the opening balance, then each entry that
 * moved money grouped by day with the money in, the money out and the balance after it, and the closing balance.
 */
export const ledgerRead: ReadDefinition = defineRead({
    id: "accounting.ledger",
    dataKind: "accounting-ledger",
    shape: "record",
    fields: ["periodKey", "fromDay", "toDay", "openingVnd", "inVnd", "outVnd", "closingVnd", "days"],
    paths: { days: "list" },
    variables,
    permission: "accounting.view",
    ports: { book: bookEntriesPort },
    run: async ({ book }, given, context): Promise<LedgerView> => {
        const period = periodOf(context.now, given.period ?? "this")
        const [before, entries] = await Promise.all([
            book.totals({ fromDay: LEDGER_EPOCH_DAY, toDay: period.fromDay }),
            book.cash(period),
        ])
        return {
            periodKey: period.key,
            fromDay: period.fromDay,
            toDay: period.toDay,
            ...ledgerOf(openingOf(before), entries),
        }
    },
})
