import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { closeVerdict, periodOf } from "../../../rules/accounting/period"
import type { CloseVerdict, PeriodKey } from "../../../rules/accounting/period"
import { questionsPort, transactionsPort } from "../ports"
import { periodVariables as variables } from "./period-variables"

/** Whether a period may close and what stops it. */
export interface CloseView extends CloseVerdict {
    /** Which period was checked. */
    readonly periodKey: PeriodKey
    /** The first day of the period, `YYYY-MM-DD`. */
    readonly fromDay: string
    /** The first day after the period, `YYYY-MM-DD`. */
    readonly toDay: string
}

/** `accounting.close-check`: whether a period may close, and what stops it (open period, unmatched payments, questions waiting). */
export const closeCheckRead: ReadDefinition = defineRead({
    id: "accounting.close-check",
    dataKind: "period-close",
    shape: "record",
    fields: ["periodKey", "fromDay", "toDay", "canClose", "blockers"],
    paths: {},
    variables,
    permission: "accounting.view",
    ports: { transactions: transactionsPort, questions: questionsPort },
    run: async ({ transactions, questions }, given, context): Promise<CloseView> => {
        const period = periodOf(context.now, given.period ?? "last")
        const [unmatched, waitingQuestions] = await Promise.all([transactions.unmatchedIn(period), questions.waiting()])
        const verdict = closeVerdict({ period, now: context.now, unmatchedPayments: unmatched.count, waitingQuestions })
        return { periodKey: period.key, fromDay: period.fromDay, toDay: period.toDay, ...verdict }
    },
})
