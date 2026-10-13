/** One credit pack; the money columns are cast to float8 in SQL so the driver answers numbers. */
export interface PackRow {
    /** The pack code. */
    readonly code: string
    /** The credits the pack adds. */
    readonly credits: number
    /** The price in VND. */
    readonly price_vnd: number
    /** The order of the catalogue. */
    readonly sort: number
}

/** One top-up lot, with numeric columns cast to float8. */
export interface TopupLotRow {
    /** Credits purchased. */
    readonly credits: number
    /** The price paid in VND. */
    readonly price_vnd: number
    /** When the lot was purchased. */
    readonly purchased_at: string
    /** When the lot expires. */
    readonly expires_at: string
    /** Credits still spendable. */
    readonly credits_remaining: number
}
