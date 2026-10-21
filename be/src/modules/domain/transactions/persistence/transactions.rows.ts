/** public.transactions as the statements select it. */
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
