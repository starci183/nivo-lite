/** A payment received that still waits for a decision. */
export interface UnmatchedPayment {
    /** The amount in VND. */
    readonly amountVnd: number
    /** Who paid, as the bank or the sender wrote it. */
    readonly senderName: string | null
    /** The bank reference, else the message body. */
    readonly memo: string
}

/** The payments waiting for a decision: how many, what they add up to, and the oldest ones. */
export interface UnmatchedPayments {
    /** How many payments wait. */
    readonly count: number
    /** What they add up to, in VND. */
    readonly total: number
    /** The oldest payments, bounded by the caller. */
    readonly items: ReadonlyArray<UnmatchedPayment>
}
