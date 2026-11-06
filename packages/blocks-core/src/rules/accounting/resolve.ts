import type { TransactionRecord } from "./accounting.types"

/** The command id the approval row of an unmatched payment runs its action under. */
export const RESOLVE_COMMAND = "accounting.resolve-unmatched-payment"

/** The kind a payment is recorded as when it paid no order. */
export const OTHER_INCOME_KIND = "other-income"

/** Why an unmatched payment cannot be resolved as other income: data the screen turns into a message, never a write. */
export type OtherIncomeRefusal = "transaction_missing" | "transaction_not_credit" | "transaction_not_open"

/** What to do with a payment the owner calls other income: record it, or refuse. */
export type OtherIncomeDecision =
    | { readonly kind: "record"; readonly transaction: TransactionRecord }
    | { readonly kind: "refuse"; readonly reason: OtherIncomeRefusal }

/** The statuses of a payment that still waits for the owner. */
const OPEN_STATUSES: ReadonlySet<string> = new Set(["unmatched", "needs_review"])

/**
 * Decides whether a payment is recorded as other income: only money in that nobody tied to an order yet and that still waits
 * (unmatched or waiting for review). A payment that is gone, money out, or already resolved is refused and changes nothing.
 */
export const otherIncomeDecision = (transaction: TransactionRecord | null): OtherIncomeDecision => {
    if (transaction === null) return { kind: "refuse", reason: "transaction_missing" }
    if (transaction.direction !== "credit") return { kind: "refuse", reason: "transaction_not_credit" }
    if (!OPEN_STATUSES.has(transaction.status)) return { kind: "refuse", reason: "transaction_not_open" }
    return { kind: "record", transaction }
}
