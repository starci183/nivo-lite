import type { InvoiceRow } from "./invoices.rows"

/** An invoice with the dates shown in a customer's flow and in Sales handoffs. */
export interface InvoiceViewRow extends InvoiceRow {
    /** The deadline, when one is set. */
    readonly due_at: string | null
    /** When it was issued. */
    readonly issued_at: string | null
    /** When it was created. */
    readonly created_at: string
}
