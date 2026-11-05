import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { waitingViewOf } from "../../../rules/sales/waiting"
import type { WaitingOrder, WaitingView } from "../../../rules/sales/waiting"
import { ORDER_QUERY_KEY, ORDERS_VIEW_ID, SALES_VIEW, WAITING_SHOWN } from "../constants"
import { salesLeadStore, salesOrderStore, salesSettings } from "../ports"
import { settingsOf } from "../settings-store"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** Where choosing a waiting order goes: the orders view with the order chosen. */
export const waitingHrefOf = (orderId: string): string =>
    `?tab=${ORDERS_VIEW_ID}&${ORDER_QUERY_KEY}=${encodeURIComponent(orderId)}`

/** `sales.orders-waiting`: the draft orders that wait for the owner, oldest first, as the waiting region reads them. */
export const ordersWaitingRead: ReadDefinition = defineRead({
    id: "sales.orders-waiting",
    dataKind: "sales-waiting",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadStore, orders: salesOrderStore, settings: salesSettings },
    run: async ({ leads, orders, settings }): Promise<WaitingView> => {
        const page = await orders.waiting(await settingsOf(settings), WAITING_SHOWN)
        const leadIds = page.rows.flatMap((order) => (order.leadId === null ? [] : [order.leadId]))
        const names: Readonly<Record<string, string>> =
            leadIds.length === 0 ? {} : await leads.names([...new Set(leadIds)])
        const waiting = page.rows.map((order): WaitingOrder => ({
            id: order.id,
            orderNo: order.orderNo,
            items: order.items,
            amountVnd: order.amountVnd,
            customer: order.leadId === null ? null : (names[order.leadId] ?? null),
        }))
        return waitingViewOf(waiting, page.total, WAITING_SHOWN, waitingHrefOf)
    },
})
