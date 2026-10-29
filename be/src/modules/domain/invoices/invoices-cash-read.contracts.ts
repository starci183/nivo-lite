/** An invoice as the cash reports read it. */
export interface CashInvoice {
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The contract the invoice renews, when it renews one. */
    readonly contractId: string | null
    /** The customer. */
    readonly leadId: string | null
    /** The day the period the invoice covers ends, as YYYY-MM-DD. */
    readonly periodEndsOn: string | null
    /** When it was issued. */
    readonly issuedAt: Date | null
    /** When it falls due. */
    readonly dueAt: Date | null
    /** When it was paid. */
    readonly paidAt: Date | null
}

/** The period a contract was already invoiced for. */
export interface InvoicedPeriod {
    /** The contract. */
    readonly contractId: string
    /** The day the invoiced period ends, as YYYY-MM-DD. */
    readonly periodEndsOn: string
}
