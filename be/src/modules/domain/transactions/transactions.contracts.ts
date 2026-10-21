import type { TransactionRow } from "./persistence/transactions.rows"

/** The part of a payment a reconciliation shows. */
export interface TransactionMoment {
    /** The money, VND. */
    readonly amount_vnd: number
    /** Who paid. */
    readonly payer: string | null
    /** The transfer content. */
    readonly reference: string | null
    /** When it happened, ISO text. */
    readonly occurred_at: string | null
}

/** A transaction, or null when the workspace has no such transaction. */
export type OptionalTransaction = TransactionRow | null

/** The money and the moment of a payment, or null when the workspace has no such payment. */
export type OptionalTransactionMoment = TransactionMoment | null

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
    /** The payer's name (the counterparty of a debit), or null. */
    readonly payer: string | null
    /** Money in (`credit`, the default) or out (`debit`) of the workspace's account. */
    readonly direction?: BankDirection
}

/** Whether a bank move put money into the workspace's account or took it out. */
export type BankDirection = "credit" | "debit"

/** Which bank credits to list: the newest live ones of a workspace, at most `limit`. */
export interface BankCreditQuery {
    /** The workspace. */
    readonly workspaceId: string
    /** Only this status (`unmatched`, `matched`, `needs_review`), or null for every status. */
    readonly status: string | null
    /** Only credits from this ISO instant, or null. */
    readonly since: string | null
    /** How many, already bounded by the caller (1 to 50). */
    readonly limit: number
}
