/** public.invoices as the statements select it. */
export interface InvoiceRow {
    /** The invoice id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The order it bills. */
    readonly order_id: string | null
    /** The customer. */
    readonly lead_id: string | null
    /** The invoice number, unique per workspace. */
    readonly invoice_no: string
    /** The amount, VND. */
    readonly amount_vnd: number
    /** `draft`, `issued`, `paid` or `void`. */
    readonly status: string
    /** `live` or `simulated`. */
    readonly origin: string
    /** Who issued it. */
    readonly issued_by: string | null
    /** When it was paid, ISO text. */
    readonly paid_at: string | null
}

/** The highest invoice number of a month. */
export interface LastInvoiceNumberRow {
    /** The number, or null when the month has none. */
    readonly invoice_no: string | null
}

/** An issued invoice with the order number and the customer's name, as a payment is matched against it. */
export interface InvoiceListingRow extends InvoiceRow {
    /** The order number, or null. */
    readonly order_no: string | null
    /** The customer's name, or null. */
    readonly contact_name: string | null
}
