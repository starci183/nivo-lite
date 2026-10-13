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
    /** `live` or `simulated`. */
    readonly origin: string
}
