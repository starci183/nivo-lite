import { defineRead, type ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { cancelVerdictOf } from "../../../rules/sales/order-status"
import { SALES_VIEW } from "../constants"
import { orderDetailOf } from "../details"
import { cancelFactsOf } from "../order-links"
import { salesInvoices, salesLeads, salesOrders, salesSettings, salesTransactions } from "../ports"
import { leadNameOf, leadOfContact, orderRowOf } from "../sales-records"
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
    "recipientName",
    "recipientPhone",
    "deliveryAddress",
    "deliveryAt",
    "amountVnd",
    "status",
    "approval",
    "canConfirm",
    "canCancel",
    "thresholdVnd",
    "confirmedBy",
    "confirmedAt",
    "createdAt",
    "shippedAt",
    "carrier",
    "trackingCode",
]

/** `blocks-core.sales.api.order.get`: one order with its customer's name and who confirms it; null when the workspace has no such order. */
export const orderRead: ReadDefinition = defineRead({
    id: "blocks-core.sales.api.order.get",
    dataKind: "order",
    shape: "record",
    fields: ORDER_DETAIL_FIELDS,
    paths: {},
    variables,
    permission: SALES_VIEW,
    ports: {
        leads: salesLeads,
        orders: salesOrders,
        settings: salesSettings,
        transactions: salesTransactions,
        invoices: salesInvoices,
    },
    run: async ({ leads, orders, settings, transactions, invoices }, { id }): Promise<OrderDetail | null> => {
        const record = await orders.get(id)
        const order = record === null ? null : orderRowOf(record)
        if (order === null) return null
        const buyer = await leadOfContact(leads, order.contactId)
        const customer = buyer === null ? null : leadNameOf(buyer.data)
        const verdict = cancelVerdictOf(await cancelFactsOf({ transactions, invoices }, order))
        return orderDetailOf(order, buyer?.id ?? null, customer, await settingsOf(settings), verdict.ok)
    },
})
