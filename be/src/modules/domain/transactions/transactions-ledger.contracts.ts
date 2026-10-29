/** The count and the amount sum of a set of payments, in VND. */
export interface PaymentTally {
    /** How many payments. */
    readonly total: number
    /** What they add up to. */
    readonly amount: number
}

/** A payment line of the monthly ledger. */
export interface LedgerPayment {
    /** When the money arrived. */
    readonly occurredAt: Date
    /** The amount in VND. */
    readonly amountVnd: number
    /** The bank reference. */
    readonly reference: string | null
    /** The payer. */
    readonly payer: string | null
    /** The channel. */
    readonly channel: string
    /** The state. */
    readonly status: string
}

/** The payment a receipt is for. */
export interface ReceiptPayment {
    /** The invoice it settles. */
    readonly invoiceId: string | null
    /** The amount in VND. */
    readonly amountVnd: number
    /** When the money arrived. */
    readonly occurredAt: Date
}
