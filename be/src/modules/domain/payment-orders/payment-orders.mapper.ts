import type { OrderDetail, PaymentOrder } from "./payment-orders.contracts"
import type { PaymentOrderEntity } from "./persistence/entities"

/** The detail of an order as an object: a stored value that is not a JSON object counts as no detail. */
const detailOf = (value: unknown): OrderDetail =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

/** Maps one stored order to the order the capability answers, its instants as ISO text. */
export const toPaymentOrder = (row: PaymentOrderEntity): PaymentOrder => ({
    id: row.id,
    workspaceId: row.workspaceId,
    planCode: row.planCode,
    amountVnd: row.amountVnd,
    orderCode: row.orderCode,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    paidAt: row.paidAt === null ? null : row.paidAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    kind: row.kind,
    packCode: row.packCode,
    detail: detailOf(row.detail),
})
