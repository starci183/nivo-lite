import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { openOrdersOf, type OpenOrdersView } from "../../../../rules/sales/ledger/open-orders"
import { openOrders } from "../accounting-data"
import { LEADS, ORDERS } from "../ports"

const variables: z.ZodObject<Record<string, never>> = z.object({})

/** The most orders the picker lists. */
export const OPEN_ORDERS_SHOWN = 50

/** `blocks-core.sales.api.order.open`: the orders that wait for money, for the owner to assign a payment nobody matched to one of them. */
export const openOrdersRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.order.open",
    dataKind: "accounting-open-order",
    shape: "record",
    fields: ["rows"],
    paths: { rows: "list" },
    variables,
    permission: "sales.view",
    ports: { orders: ORDERS, leads: LEADS },
    run: async ({ orders, leads }): Promise<OpenOrdersView> =>
        openOrdersOf(
            (await openOrders(orders, leads, OPEN_ORDERS_SHOWN)).map((listed) => ({
                id: listed.order.id,
                orderNo: listed.order.orderNo,
                amountVnd: listed.order.amountVnd,
                customer: listed.customer,
            })),
        ),
})
