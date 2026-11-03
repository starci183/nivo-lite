/** The SePay webhook body reduced to the fields NIVO reads (names exactly as in https://docs.sepay.vn); only `id` is required. */
export interface SepayPayload {
    /** The SePay transaction id: the idempotency key. */
    readonly id: number
    /** The bank gateway name. */
    readonly gateway: string | undefined
    /** `in` for a credit, `out` for a debit. */
    readonly transferType: string | undefined
    /** The amount in VND; 0 when absent, undefined when unreadable. */
    readonly transferAmount: number | undefined
    /** The transfer content. */
    readonly content: string | null
    /** The payment code SePay extracted from the content. */
    readonly code: string | null
    /** The SePay description line. */
    readonly description: string | null
}
