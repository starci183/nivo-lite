import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ListQuery, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { periodOf } from "../../../rules/accounting/period"
import type { PeriodKey } from "../../../rules/accounting/period"
import { weeklyIncomeOf } from "../../../rules/accounting/weekly"
import type { WeeklyIncome } from "../../../rules/accounting/weekly"
import { entriesSourcePort } from "../ports"
import { ENTRIES_SHAPE } from "./entries.read"
import { periodVariables as variables } from "./period-variables"

/** The most income entries the weeks add up. */
export const WEEKLY_ENTRIES_MAX = 500

const INCOME: ListQuery = {
    q: null,
    filters: { kind: "income" },
    sort: "recent",
    cursor: null,
    size: WEEKLY_ENTRIES_MAX,
}

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
    ports: { entries: entriesSourcePort },
    run: async ({ entries }, given, context): Promise<WeeklyView> => {
        const period = periodOf(context.now, given.period ?? "this")
        const weeks = weeklyIncomeOf((await entries.page(ENTRIES_SHAPE, INCOME)).rows, period.fromDay, period.toDay)
        return { periodKey: period.key, fromDay: period.fromDay, ...weeks }
    },
})
