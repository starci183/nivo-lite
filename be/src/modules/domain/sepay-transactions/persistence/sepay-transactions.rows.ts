import type { SettleOutcome } from "../sepay-transactions.contracts"

/** The outcome text the SQL settlement answers. */
export interface SettleRow {
    /** What the transfer came to for the order it named. */
    readonly outcome: SettleOutcome
}
/** A transfer tied to a workspace payment order that needs review. */
export interface ReviewTransactionRow {
    /** The provider transaction id, cast to float8 by SQL. */
    readonly id: number
    /** The settlement status. */
    readonly status: string
    /** The transfer amount, cast to float8 by SQL. */
    readonly transfer_amount: number
    /** The time the transfer was received. */
    readonly received_at: string
    /** The transfer content. */
    readonly content: string | null
}
