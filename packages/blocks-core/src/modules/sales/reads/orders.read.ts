import { portsOf } from "@nivo-lite/agent-sdk/port"
import { countsRead, listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import { ORDER_STATUSES } from "../../../rules/sales/order-status"
import { SALES_VIEW } from "../constants"
import { salesLeads, salesOrdersList } from "../ports"
import { leadNameOf, leadOfContact } from "../sales-records"
import type { OrderRow } from "../sales.types"

/** What the orders list accepts: a search over the items and the note (the number is a sequence, which is not searched), the status as a filter, two sorts. */
export const ORDERS_LIST: ListShape = {
    search: { fields: ["itemsText", "note"] },
    filters: { status: { field: "status", op: "eq", of: ORDER_STATUSES } },
    sort: { recent: [["createdAt", "desc"]], amount: [["amountVnd", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "orderNo", description: "itemsText", badge: "status" },
}

/** The fields of an order row the list returns. */
export const ORDER_ROW_FIELDS: ReadonlyArray<keyof OrderRow | "customer"> = [
    "id",
    "orderNo",
    "contactId",
    "itemsText",
    "amountVnd",
    "status",
    "createdAt",
    "customer",
]

/** `blocks-core.sales.api.order.list`: the orders of the workspace, searched, narrowed by status and sorted. */
const listedOrders: ListReadDefinition = listRead({
    id: "blocks-core.sales.api.order.list",
    dataKind: "order",
    permission: SALES_VIEW,
    fields: ORDER_ROW_FIELDS,
    list: ORDERS_LIST,
    source: salesOrdersList,
})

/** The most rows and the longest cursor one page of the orders carries. */
const PAGE_ROWS_MAX = 200
const MAX_CURSOR = 2048

/** The page a list read returns, read for what the customers need: each row keeps every field it came with. */
const pageShape = z.object({
    rows: z.array(z.looseObject({ contactId: z.string().max(MAX_ID).nullable() })).max(PAGE_ROWS_MAX),
    cursor: z.string().max(MAX_CURSOR).nullable(),
})

/** The order rows of a page with the name of each customer (empty when the order has none), so a table can draw the customer without a second read. */
export const ordersRead: ListReadDefinition = {
    ...listedOrders,
    execute: async (provider, raw, context) => {
        const listed = (await listedOrders.execute?.(provider, raw, context)) ?? { ok: false as const, problems: [] }
        const page = listed.ok ? pageShape.safeParse(listed.data) : null
        if (!listed.ok || !page?.success) return listed
        const { leads } = portsOf(provider, { leads: salesLeads })
        const ids = new Set(page.data.rows.flatMap((row) => (row.contactId === null ? [] : [row.contactId])))
        const names = new Map<string, string>()
        await Promise.all(
            [...ids].map(async (id) => {
                const lead = await leadOfContact(leads, id)
                if (lead !== null) names.set(id, leadNameOf(lead.data) ?? "")
            }),
        )
        const customerOf = (contactId: string | null): string => (contactId === null ? "" : (names.get(contactId) ?? ""))
        return {
            ok: true,
            data: { ...page.data, rows: page.data.rows.map((row) => ({ ...row, customer: customerOf(row.contactId) })) },
        }
    },
}

/** `blocks-core.sales.api.order.counts`: how many orders each status holds, under the same search. */
export const orderCountsRead: ReadDefinition = countsRead({ id: "blocks-core.sales.api.order.counts", of: ordersRead, by: "status" })
