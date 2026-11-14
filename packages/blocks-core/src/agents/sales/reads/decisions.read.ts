import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { salesDecisionQueueOf } from "../rules/decisions"
import type { DecisionQueueView } from "../../../shared/views/views.types"
import { SALES_VIEW } from "../constants"
import { salesLeads, salesOrders, salesSettings } from "../ports"
import { waitingOrdersOf } from "./waiting-orders"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** `blocks-core.sales.api.order.decisions`: the orders that wait for the owner, as a decision queue with approve and reject. */
export const decisionsRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.order.decisions",
    dataKind: "sales-decision",
    shape: "record",
    fields: ["count", "more", "rows"],
    paths: { rows: "list" },
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders, settings: salesSettings },
    run: async (ports): Promise<DecisionQueueView> => {
        const waiting = await waitingOrdersOf(ports)
        return salesDecisionQueueOf(waiting.rows, waiting.total)
    },
})
