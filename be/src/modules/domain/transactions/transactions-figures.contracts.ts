/** A bank credit as the governance figures of the dashboard read it. */
export interface CreditFigure {
    /** The transaction id. */
    readonly id: string
    /** The invoice it settles, or null. */
    readonly invoiceId: string | null
    /** The payer, or null. */
    readonly payer: string | null
    /** The bank reference, or null. */
    readonly reference: string | null
    /** The amount in VND. */
    readonly amountVnd: number
    /** The state of the transaction. */
    readonly status: string
}
