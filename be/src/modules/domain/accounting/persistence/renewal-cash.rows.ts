/** One renewal invoice of the window, as the reader answers it inside a list. */
export interface RenewalInvoiceItemRow {
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount, VND. */
    readonly amount_vnd: number
    /** The customer of the contract (or of the lead when the invoice has no contract). */
    readonly customer_name: string | null
}

/** One renewal invoice paid in the window, with the contract's end date now. */
export interface RenewalPaidItemRow extends RenewalInvoiceItemRow {
    /** The contract's end date now, `yyyy-mm-dd`. */
    readonly ends_on: string
    /** True when the contract now ends after the period the invoice billed. */
    readonly extended: boolean
}

/** One invoice still unpaid, with its due day in Vietnam. */
export interface UnpaidItemRow extends RenewalInvoiceItemRow {
    /** The due day, `yyyy-mm-dd`. */
    readonly due_on: string
}

/** One active contract ending before the horizon with no renewal invoice for its period. */
export interface ExpiringItemRow {
    /** The customer. */
    readonly customer_name: string
    /** The plan. */
    readonly plan: string | null
    /** The end date, `yyyy-mm-dd`. */
    readonly ends_on: string
    /** The amount of one term, VND, or null when unknown. */
    readonly amount_vnd: number | null
}

/** One payment received that still waits for a decision. */
export interface UnmatchedItemRow {
    /** The amount, VND, or null when the bank did not say. */
    readonly amount_vnd: number | null
    /** The payer, when the bank named one. */
    readonly sender_name: string | null
    /** The transfer content (or the raw body). */
    readonly memo: string | null
}

/** The renewal-to-cash figures of a window, one row. */
export interface RenewalCashRow {
    /** Renewal invoices issued in the window. */
    readonly issued_count: number
    /** Their total, VND. */
    readonly issued_total: number
    /** The first of them, oldest first. */
    readonly issued: ReadonlyArray<RenewalInvoiceItemRow>
    /** Renewal invoices paid in the window. */
    readonly paid_count: number
    /** Their total, VND. */
    readonly paid_total: number
    /** The first of them, oldest first. */
    readonly paid: ReadonlyArray<RenewalPaidItemRow>
    /** Invoices still unpaid that fall due before the horizon. */
    readonly unpaid_count: number
    /** Their total, VND. */
    readonly unpaid_total: number
    /** The first of them, soonest due first. */
    readonly unpaid: ReadonlyArray<UnpaidItemRow>
    /** Active contracts ending before the horizon with no renewal invoice. */
    readonly expiring_count: number
    /** The total of one term of each, VND. */
    readonly expiring_total: number
    /** The first of them, soonest first. */
    readonly expiring: ReadonlyArray<ExpiringItemRow>
    /** Payments received that wait for a decision. */
    readonly unmatched_count: number
    /** Their total, VND. */
    readonly unmatched_total: number
    /** The first of them, oldest first. */
    readonly unmatched: ReadonlyArray<UnmatchedItemRow>
}
