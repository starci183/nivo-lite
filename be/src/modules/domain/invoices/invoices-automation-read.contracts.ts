/** The columns of an invoice the debt reminder reads. */
export interface AutomationDebtInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoice_no: string
    /** The amount in VND. */
    readonly amount_vnd: number
    /** The customer. */
    readonly lead_id: string | null
    /** When it was due. */
    readonly due_at: string | null
}
