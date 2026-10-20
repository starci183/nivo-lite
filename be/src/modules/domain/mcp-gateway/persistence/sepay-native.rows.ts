/** One bank credit row. */
export interface BankTransactionRow {
    readonly id: string
    readonly amount_vnd: string | number
    readonly reference: string | null
    readonly payer: string | null
    readonly status: string
    readonly occurred_at: Date | string
}
