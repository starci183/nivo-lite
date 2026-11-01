/** Whether a supplier invoice is still to pay or an outgoing payment settled it. */
export type SupplierPayableStatus = "open" | "paid"

/** One supplier invoice the desk keeps, as the callers read it. */
export interface SupplierPayableRow {
    /** The row id; the subject of the payment's work item. */
    readonly id: string
    /** The seller name. */
    readonly supplier: string
    /** The seller tax code. */
    readonly sellerTaxCode: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The total, VND. */
    readonly amountVnd: number
    /** The issue date, `YYYY-MM-DD`. */
    readonly issuedOn: string
    /** The due date, `YYYY-MM-DD`. */
    readonly dueOn: string
    /** Whether the invoice is still to pay. */
    readonly status: SupplierPayableStatus
    /** The outgoing payment that settled it, when paid. */
    readonly debitRef: string | null
    /** When it was marked paid, ISO text, when paid. */
    readonly paidAt: string | null
    /** The work item that decided the payment, when there is one. */
    readonly workItemId: string | null
    /** When the desk first saw the invoice, ISO text. */
    readonly firstSeenAt: string
    /** Who decided the payment: a person name, or the policy. */
    readonly decidedBy: string | null
}

/** A supplier invoice the desk read from the gateway, with the date it falls due. */
export interface NewSupplierPayable {
    /** The seller name. */
    readonly supplier: string
    /** The seller tax code. */
    readonly sellerTaxCode: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The total, VND. */
    readonly amountVnd: number
    /** The issue date, `YYYY-MM-DD`. */
    readonly issuedOn: string
    /** The due date, `YYYY-MM-DD`. */
    readonly dueOn: string
}

/** What names a supplier invoice: the seller tax code and the invoice number. */
export interface SupplierPayableKeyParts {
    /** The seller tax code. */
    readonly sellerTaxCode: string
    /** The invoice number. */
    readonly invoiceNo: string
}

/** What settles an open supplier invoice. */
export interface SupplierPaymentMark {
    /** The outgoing payment own reference. */
    readonly debitRef: string
    /** When the payment was confirmed. */
    readonly paidAt: Date
    /** The work item that decided it. */
    readonly workItemId: string
    /** Who decided it. */
    readonly decidedBy: string
}
