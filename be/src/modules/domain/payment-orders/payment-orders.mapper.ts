import type { OrderDetail, PaymentOrder } from "./payment-orders.contracts"
import type { PaymentOrderEntity } from "./persistence/entities"

/** Whether a stored detail entry holds a plain value; nested values are not part of what an order records. */
const isScalarEntry = (entry: [string, unknown]): entry is [string, string | number | boolean | null] =>
    entry[1] === null || ["string", "number", "boolean"].includes(typeof entry[1])

/** The detail of an order as an object: a stored value that is not a JSON object counts as no detail. */
const detailOf = (value: unknown): OrderDetail =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(isScalarEntry))
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
