/** What one list call asks SePay for. */
export interface SepayTransactionsQuery {
    /** The bank account number the transactions belong to. */
    readonly accountNumber: string
    /** Only transactions at or after this instant. */
    readonly from: Date
    /** Only transactions at or before this instant; absent reads up to now. */
    readonly to?: Date | undefined
    /** The most rows one call answers. */
    readonly limit: number
}

/** One bank transaction SePay lists, as NIVO reads it. */
export interface SepayTransaction {
    /** The SePay transaction id, the same id the webhook delivers. */
    readonly id: string
    /** When the bank booked it. */
    readonly occurredAt: Date
    /** Money in, in VND; 0 when the transaction moved money out. */
    readonly amountIn: number
    /** Money out, in VND; 0 when the transaction moved money in. */
    readonly amountOut: number
    /** The transfer content, empty when there is none. */
    readonly content: string
    /** The code SePay read from the content, or null. */
    readonly code: string | null
    /** The bank's brand name, or null. */
    readonly bank: string | null
    /** The bank's own reference of the transaction (`reference_number`), when SePay lists one. */
    readonly reference?: string
    /** The bank account number the row itself names (`account_number`), when it names one. */
    readonly account?: string
}
