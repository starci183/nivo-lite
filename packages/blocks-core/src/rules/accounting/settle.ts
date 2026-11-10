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

/** Why a settlement is refused: a fact the caller hands back (to a step's agent, or to a person on a screen), never a throw. */
export type SettleRefusal =
    | "transaction_missing"
    | "order_missing"
    | "transaction_not_credit"
    | "order_not_open"
    | "order_unpriced"
    | "transaction_used"
    | "claim_missing"
    | "claim_closed"

/** The true values beside a refusal, read from the records: what the order is due, what arrived, the gap, the order it already paid. */
export type SettleFacts = Readonly<Record<string, string | number>>

/** How the money that arrived compares with what the order is due, both read from the records: the gap is the agent's to judge. */
export interface SettleAmounts {
    /** What the order is due, VND. */
    readonly expectedVnd: number
    /** What arrived, VND. */
    readonly receivedVnd: number
    /** What arrived less what is due: negative when short, positive when over, zero when exact. */
    readonly differenceVnd: number
}

/** What to do with a settlement: pay the order, find it already paid by this transaction, or refuse. */
export type SettleDecision =
    | {
          readonly kind: "pay"
          /** The two amounts and their gap, which a step's agent or the owner judged before asking to pay. */
          readonly facts: SettleAmounts
          /** The money that arrived. */
          readonly transaction: TransactionRecord
          /** The order it pays. */
          readonly order: OrderRecord
          /** The claim it answers, when one was named. */
          readonly claim: ClaimRecord | null
      }
    | { readonly kind: "already" }
    | { readonly kind: "refuse"; readonly reason: SettleRefusal; readonly facts: SettleFacts }

const refuse = (reason: SettleRefusal, facts: SettleFacts = {}): SettleDecision => ({ kind: "refuse", reason, facts })

/** The amounts of the two records, as far as both exist. */
const amountsOf = (transaction: TransactionRecord, order: OrderRecord): SettleFacts => ({
    receivedVnd: transaction.amountVnd,
    ...(order.amountVnd === null ? {} : { orderAmountVnd: order.amountVnd }),
})

/** Whether a claim may still be answered: it is open or escalated, and no other transaction settled it. */
const isAnswerable = (claim: ClaimRecord, transaction: TransactionRecord): boolean =>
    claim.status === "open" || claim.status === "escalated" || claim.settledTransactionId === transaction.id

/**
 * Decides one settlement. A transaction pays one order and an order is paid by one transaction: the transaction that already paid the
 * named order changes nothing. What is not true is refused and never marked paid: an unknown transaction or order, money out, an order
 * that no longer waits for money or has no total, a transaction that already paid another order, a claim that is named but unknown or
 * closed. The amount is never refused: a short or an over credit pays the order the caller named, and the decision carries the two
 * amounts and their gap, read from the records, for the caller to report. `claimId` is the claim the caller named, if any.
 */
export const settleDecision = (given: SettleCase, claimId: string | null): SettleDecision => {
    const { transaction, order, claim } = given
    if (transaction === null) return refuse("transaction_missing")
    if (order === null) return refuse("order_missing")
    if (claimId !== null && claim === null) return refuse("claim_missing")
    const facts = amountsOf(transaction, order)
    if (transaction.direction !== "credit") return refuse("transaction_not_credit", facts)
    if (transaction.orderId === order.id) return { kind: "already" }
    if (transaction.orderId !== null) return refuse("transaction_used", { ...facts, paidOrderId: transaction.orderId })
    if (!AWAITING_PAYMENT.includes(order.status)) return refuse("order_not_open", { ...facts, status: order.status })
    if (order.amountVnd === null) return refuse("order_unpriced", facts)
    if (claim !== null && !isAnswerable(claim, transaction)) return refuse("claim_closed", facts)
    const amounts: SettleAmounts = {
        expectedVnd: order.amountVnd,
        receivedVnd: transaction.amountVnd,
        differenceVnd: transaction.amountVnd - order.amountVnd,
    }
    return { kind: "pay", facts: amounts, transaction, order, claim }
}

const AMOUNT = new Intl.NumberFormat("vi-VN")

/** The confirmation the customer is told: the template with `{orderNo}` and `{amount}` filled. */
export const confirmationText = (template: string, orderNo: string, amountVnd: number): string =>
    template.replace("{orderNo}", orderNo).replace("{amount}", AMOUNT.format(amountVnd))
