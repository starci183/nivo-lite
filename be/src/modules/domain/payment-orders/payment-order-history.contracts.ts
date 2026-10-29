/** How many plan payments a workspace already made, split by the price they were made at. */
export interface PlanPaymentCounts {
    /** Paid plan orders at full price. */
    readonly fullPrice: number
    /** Paid plan orders at the intro price. */
    readonly promo: number
}
