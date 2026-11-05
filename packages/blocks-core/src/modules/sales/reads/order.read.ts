import { defineRead } from "@nivo-lite/agent-sdk/block"
import type { ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { SALES_VIEW } from "../constants"
import { orderDetailOf } from "../details"
import { salesLeadStore, salesOrderStore, salesSettings } from "../ports"
import { settingsOf } from "../settings-store"
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
    dataKind: "sales-order",
    shape: "record",
    fields: ORDER_DETAIL_FIELDS,
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: { leads: salesLeadStore, orders: salesOrderStore, settings: salesSettings },
    run: async ({ leads, orders, settings }, { id }): Promise<OrderDetail | null> => {
        const order = await orders.get(id)
        if (order === null) return null
        const names: Readonly<Record<string, string>> = order.leadId === null ? {} : await leads.names([order.leadId])
        const customer = order.leadId === null ? null : (names[order.leadId] ?? null)
        return orderDetailOf(order, customer, await settingsOf(settings))
    },
})
