/** What the settlement of a payment order made of a transfer. */
export type SettleOutcome = "paid" | "underpaid" | "expired" | "unmatched" | "ignored"

/** The part of a payment order the settlement decision reads. */
export interface PaymentOrderTerms {
    /** Where the order stands. */
    readonly status: string
    /** The amount due, in VND. */
    readonly amountVnd: number
    /** When the order stops waiting for money, ISO text. */
    readonly expiresAt: string
}

/**
 * The status a bank transfer row ends in. An outgoing transfer is ignored. A second transfer for an order that is already paid comes
 * back as "ignored"; it stays listed for the manual review as unmatched.
 */
export const transferStatus = (isCredit: boolean, outcome: SettleOutcome): SettleOutcome => {
    if (!isCredit) return "ignored"
    return outcome === "ignored" ? "unmatched" : outcome
}

/**
 * What a transfer of `amount` VND does to the payment order its code names: an order already paid is ignored, one that is not pending
 * or has expired is expired, an amount below the due one is underpaid, anything else pays the order.
 */
export const paymentOrderOutcome = (order: PaymentOrderTerms, amount: number, now: Date): SettleOutcome => {
    if (order.status === "paid") return "ignored"
    if (order.status !== "pending" || Date.parse(order.expiresAt) < now.getTime()) return "expired"
    return amount < order.amountVnd ? "underpaid" : "paid"
}
