/** The count and the amount sum of a set of invoices, in VND. */
export interface InvoiceTally {
    /** How many invoices. */
    readonly total: number
    /** What they add up to. */
    readonly amount: number
}

/** An issued invoice past its due date. */
export interface OverdueInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** When it was due. */
    readonly dueAt: Date | null
    /** The customer. */
    readonly leadId: string | null
}

/** An invoice line of the monthly ledger. */
export interface LedgerInvoice {
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** When it was issued. */
    readonly issuedAt: Date | null
    /** The state. */
    readonly status: string
}

/** The invoice a receipt is for. */
export interface ReceiptInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The customer. */
    readonly leadId: string | null
    /** When it was paid. */
    readonly paidAt: Date | null
}
