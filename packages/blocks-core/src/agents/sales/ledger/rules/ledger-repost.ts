import type { OrderRecord, TransactionRecord } from "./accounting.types"

/** The command of the re-post: the id of its action. */
export const REPOST_COMMAND = "sales.repost-ledger"

/** Why a payment cannot be written to the ledger again: data the screen turns into a message, never a write. */
export type RepostRefusal = "transaction_missing" | "transaction_not_paid" | "order_missing" | "order_not_paid"

/** What to do with a request to write a payment to the ledger again: queue the job for it, or refuse. */
export type RepostDecision =
    | { readonly kind: "queue"; readonly transaction: TransactionRecord; readonly order: OrderRecord }
    | { readonly kind: "refuse"; readonly reason: RepostRefusal }

/**
 * Decides whether a payment is written to the ledger again: only a payment that paid an order, and an order that is paid. Whether the
 * row is already in the sheet is not asked here: the ledger writes a transaction once whatever the number of jobs, so a job for a
 * payment already written is a no-op.
 */
export const repostDecision = (transaction: TransactionRecord | null, order: OrderRecord | null): RepostDecision => {
    if (transaction === null) return { kind: "refuse", reason: "transaction_missing" }
    if (transaction.status !== "matched" || transaction.orderId === null)
        return { kind: "refuse", reason: "transaction_not_paid" }
    if (order === null) return { kind: "refuse", reason: "order_missing" }
    if (order.status !== "paid") return { kind: "refuse", reason: "order_not_paid" }
    return { kind: "queue", transaction, order }
}

/** Whether the screen offers the re-post for a payment: the request would be queued. */
export const canRepost = (transaction: TransactionRecord | null, order: OrderRecord | null): boolean =>
    repostDecision(transaction, order).kind === "queue"
