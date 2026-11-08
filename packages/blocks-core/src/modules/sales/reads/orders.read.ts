import { countsRead, listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import type { ListShape, ReadDefinition } from "@nivo-lite/agent-sdk/block"
import { ORDER_STATUSES } from "../../../rules/sales/order-status"
import { SALES_VIEW } from "../constants"
import { salesOrdersList } from "../ports"
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
export const ORDER_ROW_FIELDS: ReadonlyArray<keyof OrderRow> = [
    "id",
    "orderNo",
    "leadId",
    "itemsText",
    "amountVnd",
    "status",
    "createdAt",
]

/** `sales.orders`: the orders of the workspace, searched, narrowed by status and sorted. */
export const ordersRead: ListReadDefinition = listRead({
    id: "sales.orders",
    dataKind: "order",
    permission: SALES_VIEW,
    fields: ORDER_ROW_FIELDS,
    list: ORDERS_LIST,
    source: salesOrdersList,
})

/** `sales.order-counts`: how many orders each status holds, under the same search. */
export const orderCountsRead: ReadDefinition = countsRead({ id: "sales.order-counts", of: ordersRead, by: "status" })
