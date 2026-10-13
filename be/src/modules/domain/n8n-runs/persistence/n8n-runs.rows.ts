/** The columns of a run the token check reads. */
export interface N8nRunRow {
    /** The run id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The template key. */
    readonly template_key: string
    /** The hash of the run token. */
    readonly token_hash: string
    /** When the token expires. */
    readonly expires_at: string
    /** How the run stands. */
    readonly status: string
}

/** The settings and the approved wording of the pipeline a run belongs to. */
export interface RunPipelineRow {
    /** The settings. */
    readonly config: Record<string, unknown>
    /** The approved message template. */
    readonly body: string | null
}

/** A run just created: its id and the token, which is shown once. */
export interface CreatedRunRow {
    /** The run id. */
    readonly id: string
    /** The bearer token the workflow presents. */
    readonly token: string
}

/** The figures of a day. */
export interface DayNumbersRow {
    /** New leads. */
    readonly new_leads: number
    /** Orders confirmed. */
    readonly orders_confirmed: number
    /** Money received (a bigint the driver answers as text). */
    readonly money_in: string | number
    /** Payments received. */
    readonly money_in_count: number
    /** Amount invoiced (a bigint the driver answers as text). */
    readonly invoiced: string | number
    /** Invoices issued. */
    readonly invoices_issued: number
    /** Decisions waiting. */
    readonly waiting_decisions: number
    /** Invoices overdue. */
    readonly overdue_count: number
    /** Amount overdue (a bigint the driver answers as text). */
    readonly overdue_total: string | number
}

/** An overdue invoice. */
export interface OverdueInvoiceRow {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** When it was due. */
    readonly due_at: string | null
    /** The customer. */
    readonly lead_id: string | null
}

/** A lead's name and address. */
export interface LeadContactRow {
    /** The lead id. */
    readonly id: string
    /** The name. */
    readonly contact_name: string
    /** The address. */
    readonly email: string | null
}

/** A payment of the ledger. */
export interface LedgerTransactionRow {
    /** When the money arrived. */
    readonly occurred_at: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** The bank reference. */
    readonly reference: string | null
    /** The payer. */
    readonly payer: string | null
    /** The channel. */
    readonly channel: string
    /** The state. */
    readonly status: string
}

/** An invoice of the ledger. */
export interface LedgerInvoiceRow {
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** When it was issued. */
    readonly issued_at: string | null
    /** The state. */
    readonly status: string
}

/** The invoice a receipt is for. */
export interface ReceiptInvoiceRow {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** The customer. */
    readonly lead_id: string | null
    /** When it was paid. */
    readonly paid_at: string | null
}

/** The payment a receipt is for. */
export interface ReceiptTransactionRow {
    /** The invoice it settles. */
    readonly invoice_id: string | null
    /** The amount in VND. */
    readonly amount_vnd: number
    /** When the money arrived. */
    readonly occurred_at: string
}
