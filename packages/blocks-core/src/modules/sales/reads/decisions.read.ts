import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { salesDecisionQueueOf } from "../../../rules/sales/decisions"
import type { DecisionQueueView } from "../../../views/views.types"
import { SALES_VIEW } from "../constants"
import { salesLeadStore, salesOrderStore, salesSettings } from "../ports"
import { waitingOrdersOf } from "./waiting-orders"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `sales.decisions`: the orders that wait for the owner, as a decision queue with approve and reject. */
export const decisionsRead: ReadDefinition = defineRead({
    id: "sales.decisions",
    dataKind: "sales-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadStore, orders: salesOrderStore, settings: salesSettings },
    run: async (stores): Promise<DecisionQueueView> => {
        const waiting = await waitingOrdersOf(stores)
        return salesDecisionQueueOf(waiting.rows, waiting.total)
    },
})
