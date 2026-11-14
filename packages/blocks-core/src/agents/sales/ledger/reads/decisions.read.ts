import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { unmatchedQueueOf } from "../rules/decisions"
import { periodOf } from "../rules/period"
import type { DecisionQueueView } from "../../../../shared/views/views.types"
import { unmatchedIn, unmatchedPayments } from "../accounting-data"
import { TRANSACTIONS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most payments the queue lists. */
export const UNMATCHED_SHOWN = 5

/** `blocks-core.sales.api.transaction.decisions`: the payments of this month nobody tied to an invoice, for the owner to look at. */
export const decisionsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.transaction.decisions",
    dataKind: "accounting-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: "sales.view",
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
