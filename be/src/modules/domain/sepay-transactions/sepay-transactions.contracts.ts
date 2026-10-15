/** The SePay API-key authorization header, absent when the delivery provides no proof. */
export type SepayAuthorization = string | undefined

/** What the SQL settlement made of a transfer for the order it named. */
export type SettleOutcome = "paid" | "underpaid" | "expired" | "unmatched" | "ignored"

/** A transfer tied to a payment order that still needs review. */
export interface ReviewTransaction {
    /** The provider transaction id. */
    readonly id: number
    /** The unmatched, expired or underpaid settlement status. */
    readonly status: string
    /** The amount transferred in VND. */
    readonly transferAmount: number
    /** When the transfer was received, ISO 8601. */
    readonly receivedAt: string
    /** The transfer content. */
    readonly content: string | null
}
