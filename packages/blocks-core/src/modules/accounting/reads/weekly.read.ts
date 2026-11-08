import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { periodOf, type PeriodKey } from "../../../rules/accounting/period"
import { weeklyIncomeOf, type WeeklyIncome } from "../../../rules/accounting/weekly"
import { incomeEntries } from "../accounting-data"
import { BOOK } from "../ports"
import { periodVariables as variables } from "./period-variables"

/** The money received in each week of a period with the period it is for. */
export interface WeeklyView extends WeeklyIncome {
    /** Which period the weeks are of. */
    readonly periodKey: PeriodKey
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
}

/** `accounting.weekly`: the money received in each week of a period, for the bars. */
export const weeklyRead: ReadDefinition = defineRead({
    id: "accounting.weekly",
    dataKind: "accounting-weekly",
    shape: "record",
    fields: ["periodKey", "fromDay", "w1", "w2", "w3", "w4", "w5"],
    paths: {},
    variables,
    permission: "accounting.view",
    ports: { book: BOOK },
    run: async ({ book }, given, context): Promise<WeeklyView> => {
        const period = periodOf(context.now, given.period ?? "this")
        const weeks = weeklyIncomeOf(await incomeEntries(book, period), period.fromDay, period.toDay)
        return { periodKey: period.key, fromDay: period.fromDay, ...weeks }
    },
})
