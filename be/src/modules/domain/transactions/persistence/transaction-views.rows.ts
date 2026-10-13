import type { TransactionRow } from "./transactions.rows"

/** A payment as a customer's flow displays it. */
export interface TransactionViewRow extends TransactionRow {
    /** The payment channel. */
    readonly channel: string
    /** When the payment occurred. */
    readonly occurred_at: string
    /** When the record was created. */
    readonly created_at: string
}
