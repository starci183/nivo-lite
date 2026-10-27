import type { InvoiceRow } from "./persistence/invoices.rows"

/** The states of an invoice a customer's payment claim is checked against: still open, or already paid. */
export type ClaimableState = "issued" | "paid"

/** An invoice, or null when the workspace has no such invoice. */
export type OptionalInvoice = InvoiceRow | null

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
    readonly invoice: InvoiceRow
    /** False when the order or the contract period already had its invoice, so nothing was issued. */
    readonly created: boolean
}
