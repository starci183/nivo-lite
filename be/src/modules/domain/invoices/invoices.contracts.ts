/** The states of an invoice a customer's payment claim is checked against: still open, or already paid. */
export type ClaimableState = "issued" | "paid"

/** An invoice, or null when the workspace has no such invoice. */
export type OptionalInvoice = InvoiceRecord | null

/** What issuing an invoice takes. */
export interface NewInvoice {
    /** The workspace. */
    readonly workspaceId: string
    /** The order it bills, or null for an invoice without an order. */
    readonly orderId: string | null
    /** The customer. */
    readonly leadId: string | null
    /** The amount, VND. */
    readonly amountVnd: number
    /** The display name of the issuer. */
    readonly issuedBy: string
}

/** What issuing the renewal invoice of a contract period takes. */
export interface NewRenewalInvoice {
    /** The workspace. */
    readonly workspaceId: string
    /** The contract being renewed. */
    readonly contractId: string
    /** The customer. */
    readonly leadId: string | null
    /** The amount, VND. */
    readonly amountVnd: number
    /** The contract end date this invoice renews, `YYYY-MM-DD`: one invoice per contract and date. */
    readonly periodEndsOn: string
    /** The display name of the issuer, or null when the system issues it. */
    readonly issuedBy: string | null
}

/** What issuing an invoice answered. */
export interface IssuedInvoice {
    /** The new invoice, or the one the order or the contract period already had. */
    readonly invoice: InvoiceRecord
    /** False when the order or the contract period already had its invoice, so nothing was issued. */
    readonly created: boolean
}

/** One public.invoices row as the statements answer it: the amount a number and the dates as text. */
export interface InvoiceRecord {
    /** The invoice id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The order it bills, or null. */
    readonly order_id: string | null
    /** The customer it bills, or null. */
    readonly lead_id: string | null
    /** The number. */
    readonly invoice_no: string
    /** The amount, VND. */
    readonly amount_vnd: number
    /** Where the invoice stands. */
    readonly status: string
    /** The display name of the issuer, or null. */
    readonly issued_by: string | null
    /** When it was paid, as database text, or null. */
    readonly paid_at: string | null
    /** The contract it renews, or null. */
    readonly contract_id: string | null
    /** The end date of the contract period it renews, or null. */
    readonly period_ends_on: string | null
}

/** An open invoice with the order and customer labels a payment is matched against. */
export interface InvoiceListingRecord extends InvoiceRecord {
    /** The order number, or null. */
    readonly order_no: string | null
    /** The customer's contact name, or null. */
    readonly contact_name: string | null
}

/** An invoice with its dates, for the Sales views. */
export interface InvoiceViewRecord extends InvoiceRecord {
    /** When payment is due, ISO text, or null. */
    readonly due_at: string | null
    /** When it was issued, ISO text, or null. */
    readonly issued_at: string | null
    /** When it was created, ISO text. */
    readonly created_at: string
}

/** The order of an invoice as the accounting book reads it. */
export interface InvoiceAccountingOrder {
    /** The order number. */
    readonly order_no: string
    /** The items, as text. */
    readonly items: string
    /** The order amount, VND, or null. */
    readonly amount_vnd: number | null
    /** The order status. */
    readonly status: string
}

/** The customer of an invoice as the accounting book reads them. */
export interface InvoiceAccountingLead {
    /** The contact name. */
    readonly contact_name: string
    /** The company. */
    readonly company: string
}

/** An invoice with its related order and customer, for the accounting book. */
export interface InvoiceAccountingRecord extends InvoiceViewRecord {
    /** The order it bills, or null. */
    readonly order: InvoiceAccountingOrder | null
    /** The customer it bills, or null. */
    readonly lead: InvoiceAccountingLead | null
}

/** An invoice a reconciliation proposes, with the customer, the order and both statuses. */
export interface ReconcileInvoiceRecord {
    /** The invoice id. */
    readonly id: string
    /** The number. */
    readonly invoice_no: string
    /** The amount, VND. */
    readonly amount_vnd: number
    /** The invoice status. */
    readonly status: string
    /** The customer's contact name, or null. */
    readonly customer: string | null
    /** The company, or null. */
    readonly company: string | null
    /** The order number, or null. */
    readonly order_no: string | null
    /** The order items, or null. */
    readonly order_items: string | null
    /** The order status, or null. */
    readonly order_status: string | null
    /** When it was issued, ISO text, or null. */
    readonly issued_at: string | null
    /** When payment is due, ISO text, or null. */
    readonly due_at: string | null
}
