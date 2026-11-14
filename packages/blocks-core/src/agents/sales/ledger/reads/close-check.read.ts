import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { closeVerdict, periodOf, type CloseVerdict, type PeriodKey } from "../rules/period"
import { escalatedClaims, unmatchedIn } from "../accounting-data"
import { CLAIMS, TRANSACTIONS } from "../ports"
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

/**
 * `blocks-core.sales.api.entry.close-check`: whether a period may close, and what stops it (open period, unmatched payments, questions waiting). The
 * questions that wait for the owner are the payment claims the graph escalated: no other record of the books asks the owner anything.
 */
export const closeCheckRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.entry.close-check",
    dataKind: "period-close",
    shape: "record",
    fields: ["periodKey", "fromDay", "toDay", "canClose", "blockers"],
    paths: {},
    variables,
    permission: "sales.view",
    ports: { transactions: TRANSACTIONS, claims: CLAIMS },
    run: async ({ transactions, claims }, given, context): Promise<CloseView> => {
        const period = periodOf(context.now, given.period ?? "last")
        const [unmatched, waitingQuestions] = await Promise.all([
            unmatchedIn(transactions, period),
            escalatedClaims(claims),
        ])
        const verdict = closeVerdict({ period, now: context.now, unmatchedPayments: unmatched.count, waitingQuestions })
        return { periodKey: period.key, fromDay: period.fromDay, toDay: period.toDay, ...verdict }
    },
})
