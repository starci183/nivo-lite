import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { unmatchedQueueOf } from "../../../rules/accounting/decisions"
import { periodOf } from "../../../rules/accounting/period"
import type { DecisionQueueView } from "../../../views/views.types"
import { unmatchedIn, unmatchedPayments } from "../accounting-data"
import { TRANSACTIONS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most payments the queue lists. */
export const UNMATCHED_SHOWN = 5

/** `accounting.decisions`: the payments of this month nobody tied to an invoice, for the owner to look at. */
export const decisionsRead: ReadDefinition = defineRead({
    id: "accounting.decisions",
    dataKind: "accounting-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { transactions: TRANSACTIONS },
    run: async ({ transactions }, _given, context): Promise<DecisionQueueView> => {
        const period = periodOf(context.now, "this")
        const [rows, total] = await Promise.all([
            unmatchedPayments(transactions, period, UNMATCHED_SHOWN),
            unmatchedIn(transactions, period),
        ])
        return unmatchedQueueOf(rows, total.count)
    },
})
