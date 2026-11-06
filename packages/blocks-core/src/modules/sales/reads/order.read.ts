import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { DEFAULT_THRESHOLD_VND } from "../../../nodes/order/needs-approval.node"
import { SALES_VIEW } from "../constants"
import { orderDetailOf } from "../details"
import { salesLeads, salesOrders } from "../ports"
import { leadNameOf, orderRowOf } from "../sales-records"
import type { OrderDetail } from "../sales.types"

const variables: z.ZodObject<{ id: z.ZodString }> = z.object({ id: z.string().min(1).max(MAX_ID) })

/** The fields of an order detail. */
export const ORDER_DETAIL_FIELDS: ReadonlyArray<keyof OrderDetail> = [
    "id",
    "orderNo",
    "leadId",
    "customer",
    "items",
    "note",
    "amountVnd",
    "status",
    "approval",
    "thresholdVnd",
    "confirmedBy",
    "confirmedAt",
    "createdAt",
    "shippedAt",
    "carrier",
    "trackingCode",
]

/** `sales.order`: one order with its customer's name and who confirms it; null when the workspace has no such order. */
export const orderRead: ReadDefinition = defineRead({
    id: "sales.order",
    dataKind: "order",
    shape: "record",
    fields: ORDER_DETAIL_FIELDS,
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeads, orders: salesOrders },
    run: async ({ leads, orders }, { id }): Promise<OrderDetail | null> => {
        const record = await orders.get(id)
        const order = record === null ? null : orderRowOf(record)
        if (order === null) return null
        const buyer = order.leadId === null ? null : await leads.get(order.leadId)
        const customer = buyer === null ? null : leadNameOf(buyer.data)
        return orderDetailOf(order, customer, DEFAULT_THRESHOLD_VND)
    },
})
