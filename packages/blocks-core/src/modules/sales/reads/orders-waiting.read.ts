import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { waitingViewOf, type WaitingView } from "../../../rules/sales/waiting"
import { ORDER_QUERY_KEY, ORDERS_VIEW_ID, SALES_VIEW, WAITING_SHOWN } from "../constants"
import { salesLeads, salesOrders, salesSettings } from "../ports"
import { waitingOrdersOf } from "./waiting-orders"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** Where choosing a waiting order goes: the orders view with the order chosen. */
export const waitingHrefOf = (orderId: string): string =>
    `?tab=${ORDERS_VIEW_ID}&${ORDER_QUERY_KEY}=${encodeURIComponent(orderId)}`

/** `blocks-core.sales.api.order.waiting`: the draft orders that wait for the owner, oldest first, as the waiting region reads them. */
export const ordersWaitingRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.order.waiting",
    dataKind: "sales-waiting",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders, settings: salesSettings },
    run: async (ports): Promise<WaitingView> => {
        const waiting = await waitingOrdersOf(ports)
        return waitingViewOf(waiting.rows, waiting.total, WAITING_SHOWN, waitingHrefOf)
    },
})
