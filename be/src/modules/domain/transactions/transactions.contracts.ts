/** A transaction as the statements select it. */
export interface TransactionRow {
    /** The transaction id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The input the payment arrived as. */
    readonly inbound_event_id: string | null
    /** The money, VND. */
    readonly amount_vnd: number
    /** The transfer content. */
    readonly reference: string | null
    /** The payer's name. */
    readonly payer: string | null
    /** The invoice it settled. */
    readonly invoice_id: string | null
    /** `unmatched`, `matched` or `needs_review`. */
    readonly status: string
}

/** The input that delivered a payment, as the accounting book reads it. */
export interface TransactionAccountingInboundRow {
    /** The source channel. */
    readonly channel: string
    /** The channel's own event id. */
    readonly event_id: string | null
    /** The source text. */
    readonly body: string
    /** The sender's name. */
    readonly sender_name: string | null
}

/** A payment with its dates and source for the accounting book. */
export interface TransactionAccountingRow extends TransactionRow {
    /** The payment channel. */
    readonly channel: string
    /** When the payment occurred, ISO text. */
    readonly occurred_at: string
    /** When it was written, ISO text. */
    readonly created_at: string
    /** The input, when it still exists in this workspace. */
    readonly inbound: TransactionAccountingInboundRow | null
}

/** A live bank credit as the gateway's SePay connector lists it. */
export interface BankCreditRow {
    /** The transaction id. */
    readonly id: string
    /** The money, VND. */
    readonly amount_vnd: number
    /** The transfer content. */
    readonly reference: string | null
    /** The payer's name. */
    readonly payer: string | null
    /** `unmatched`, `matched` or `needs_review`. */
    readonly status: string
    /** When it happened, ISO text. */
    readonly occurred_at: string
}

/** A payment as a customer's flow displays it. */
export interface TransactionViewRow extends TransactionRow {
    /** The payment channel. */
    readonly channel: string
    /** When the payment occurred. */
    readonly occurred_at: string
    /** When the record was created. */
    readonly created_at: string
}

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
