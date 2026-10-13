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

/** The order an invoice bills, as the accounting book reads it. */
export interface InvoiceAccountingOrderRow {
    /** The order number. */
    readonly order_no: string
    /** The ordered items. */
    readonly items: string
    /** The amount, VND. */
    readonly amount_vnd: number | null
    /** The order status. */
    readonly status: string
}

/** The customer an invoice bills. */
export interface InvoiceAccountingLeadRow {
    /** The contact's name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
}

/** An invoice with its dates and related records for the accounting book. */
export interface InvoiceAccountingRow extends InvoiceRow {
    /** When it was issued, ISO text. */
    readonly issued_at: string | null
    /** When it is due, ISO text. */
    readonly due_at: string | null
    /** When it was written, ISO text. */
    readonly created_at: string
    /** The order, when it still exists in this workspace. */
    readonly order: InvoiceAccountingOrderRow | null
    /** The customer, when it still exists in this workspace. */
    readonly lead: InvoiceAccountingLeadRow | null
}
