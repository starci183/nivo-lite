import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { openOrdersOf } from "../../../rules/accounting/open-orders"
import type { OpenOrdersView } from "../../../rules/accounting/open-orders"
import { openOrders } from "../accounting-data"
import { ORDERS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most orders the picker lists. */
export const OPEN_ORDERS_SHOWN = 50

/** `accounting.open-orders`: the orders that wait for money, for the owner to assign a payment nobody matched to one of them. */
export const openOrdersRead: ReadDefinition = defineRead({
    id: "accounting.open-orders",
    dataKind: "accounting-open-order",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables,
    permission: "accounting.view",
    ports: { orders: ORDERS },
    run: async ({ orders }): Promise<OpenOrdersView> =>
        openOrdersOf(
            (await openOrders(orders, OPEN_ORDERS_SHOWN)).map((listed) => ({
                id: listed.order.id,
                orderNo: listed.order.orderNo,
                amountVnd: listed.order.amountVnd,
                customer: listed.customer,
            })),
        ),
})
