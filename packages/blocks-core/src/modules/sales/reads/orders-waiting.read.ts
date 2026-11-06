import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { q } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { DEFAULT_THRESHOLD_VND } from "../../../nodes/order/needs-approval.node"
import { waitingViewOf } from "../../../rules/sales/waiting"
import type { WaitingOrder, WaitingView } from "../../../rules/sales/waiting"
import { ORDER_QUERY_KEY, ORDERS_VIEW_ID, SALES_VIEW, WAITING_SHOWN } from "../constants"
import { salesOrders } from "../ports"
import { LEAD_NAME_FIELDS, ORDER_FIELDS, leadNameOf, orderRowOf } from "../sales-records"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** Where choosing a waiting order goes: the orders view with the order chosen. */
export const waitingHrefOf = (orderId: string): string =>
    `?tab=${ORDERS_VIEW_ID}&${ORDER_QUERY_KEY}=${encodeURIComponent(orderId)}`

/** The draft orders that wait for the owner: their total is at the threshold or above, or still unknown. */
const WAITING: FilterExpr = q.and(
    q.eq("status", "draft"),
    q.or(q.isNull("amountVnd"), q.gte("amountVnd", DEFAULT_THRESHOLD_VND)),
)

/** `sales.orders-waiting`: the draft orders that wait for the owner, oldest first, as the waiting region reads them. */
export const ordersWaitingRead: ReadDefinition = defineRead({
    id: "sales.orders-waiting",
    dataKind: "sales-waiting",
    shape: "record",
    fields: ["count", "rows", "linkLabel", "linkHref", "more"],
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { orders: salesOrders },
    run: async ({ orders }): Promise<WaitingView> => {
        const page = await orders.list({
            select: ORDER_FIELDS,
            join: { lead: LEAD_NAME_FIELDS },
            where: WAITING,
            order: [
                ["createdAt", "asc"],
                ["id", "asc"],
            ],
            page: { size: WAITING_SHOWN },
        })
        const totals = await orders.aggregate({ where: WAITING, measures: { count: { kind: "count" } }, limit: 1 })
        const waiting = page.rows.flatMap((listed): Array<WaitingOrder> => {
            const order = orderRowOf(listed.row)
            const buyer = listed.joined["lead"]
            return order === null
                ? []
                : [
                      {
                          id: order.id,
                          orderNo: order.orderNo,
                          items: order.items,
                          amountVnd: order.amountVnd,
                          customer: buyer === undefined || buyer === null ? null : leadNameOf(buyer.data),
                      },
                  ]
        })
        const count = totals[0]?.measures["count"]
        return waitingViewOf(waiting, typeof count === "number" ? count : waiting.length, WAITING_SHOWN, waitingHrefOf)
    },
})
