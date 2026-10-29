/** An invoice as the governance figures of the dashboard read it. */
export interface InvoiceFigure {
    /** The invoice id. */
    readonly id: string
    /** The order it bills, or null. */
    readonly orderId: string | null
    /** The customer, or null. */
    readonly leadId: string | null
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The state of the invoice. */
    readonly status: string
}
