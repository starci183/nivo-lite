import type { OrderDetail, PaymentOrder } from "./payment-orders.contracts"
import type { OrderRow } from "./persistence/payment-orders.rows"

/** The detail of an order as an object: a stored value that is not a JSON object counts as no detail. */
const detailOf = (value: OrderRow["detail"]): OrderDetail =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}

/** Maps one order row to the order the capability answers, its instants as ISO text. */
export const toPaymentOrder = (row: OrderRow): PaymentOrder => ({
    id: row.id,
    workspaceId: row.workspace_id,
    planCode: row.plan_code,
    amountVnd: row.amount_vnd,
    orderCode: row.order_code,
    status: row.status,
    expiresAt: new Date(row.expires_at).toISOString(),
    paidAt: row.paid_at === null ? null : new Date(row.paid_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
    kind: row.kind,
    packCode: row.pack_code,
    detail: detailOf(row.detail),
})
