import type { TransactionRow } from "./persistence/transactions.rows"

/** A transaction, or null when the workspace has no such transaction. */
export type OptionalTransaction = TransactionRow | null

/** What recording an unmatched payment takes. */
export interface NewTransaction {
    /** The workspace. */
    readonly workspaceId: string
    /** The input the payment arrived as, when there is one. */
    readonly inboundEventId: string | null
    /** The money, VND. */
    readonly amountVnd: number
    /** The transfer content, or null. */
    readonly reference: string | null
    /** The payer's name, or null. */
    readonly payer: string | null
    /** Real or simulated. */
    readonly origin: string
}
