import type { ClaimRecord, OrderRecord, TransactionRecord } from "./accounting.types"

/** The statuses of an order that waits for money. */
export const AWAITING_PAYMENT: ReadonlyArray<string> = ["confirmed", "invoiced"]

/** What is settled: the money that arrived, the order it should pay and the claim a customer made, when one started it. */
export interface SettleCase {
    /** The transaction that arrived; null when it was not found. */
    readonly transaction: TransactionRecord | null
    /** The order the transaction should pay; null when it was not found. */
    readonly order: OrderRecord | null
    /** The claim this settlement answers; null when none was named or found. */
    readonly claim: ClaimRecord | null
}

/** Why a settlement is refused: data the graph turns into a question for the owner. */
export type SettleRefusal =
    | "transaction_missing"
    | "order_missing"
    | "transaction_not_credit"
    | "order_not_open"
    | "amount_differs"
    | "transaction_used"
    | "claim_missing"
    | "claim_closed"

/** What to do with a settlement: pay the order, find it already paid by this transaction, or refuse. */
export type SettleDecision =
    | {
          readonly kind: "pay"
          /** The money that arrived. */
          readonly transaction: TransactionRecord
          /** The order it pays. */
          readonly order: OrderRecord
          /** The claim it answers, when one was named. */
          readonly claim: ClaimRecord | null
      }
    | { readonly kind: "already" }
    | { readonly kind: "refuse"; readonly reason: SettleRefusal }

const refuse = (reason: SettleRefusal): SettleDecision => ({ kind: "refuse", reason })

/** Whether a claim may still be answered: it is open or escalated, and no other transaction settled it. */
const isAnswerable = (claim: ClaimRecord, transaction: TransactionRecord): boolean =>
    claim.status === "open" || claim.status === "escalated" || claim.settledTransactionId === transaction.id

/**
 * Decides one settlement. A transaction pays one order and an order is paid by one transaction: the transaction that already paid the
 * named order changes nothing. Anything not clean (an unknown transaction or order, money out, an order that no longer waits for
 * money, another amount, a transaction that already paid another order, a claim that is named but unknown or closed) is refused and
 * never marked paid. `claimId` is the claim the caller named, if any.
 */
export const settleDecision = (given: SettleCase, claimId: string | null): SettleDecision => {
    const { transaction, order, claim } = given
    if (transaction === null) return refuse("transaction_missing")
    if (order === null) return refuse("order_missing")
    if (claimId !== null && claim === null) return refuse("claim_missing")
    if (transaction.direction !== "credit") return refuse("transaction_not_credit")
    if (transaction.orderId === order.id) return { kind: "already" }
    if (transaction.orderId !== null) return refuse("transaction_used")
    if (!AWAITING_PAYMENT.includes(order.status)) return refuse("order_not_open")
    if (order.amountVnd !== transaction.amountVnd) return refuse("amount_differs")
    return claim === null || isAnswerable(claim, transaction)
        ? { kind: "pay", transaction, order, claim }
        : refuse("claim_closed")
}

const AMOUNT = new Intl.NumberFormat("vi-VN")

/** The confirmation the customer is told: the template with `{orderNo}` and `{amount}` filled. */
export const confirmationText = (template: string, orderNo: string, amountVnd: number): string =>
    template.replace("{orderNo}", orderNo).replace("{amount}", AMOUNT.format(amountVnd))
