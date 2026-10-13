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

/** One top-up lot of a workspace. */
export interface LotRow {
    /** The credits bought. */
    readonly credits: number
    /** The VND paid. */
    readonly price_vnd: number
    /** When it was bought. */
    readonly purchased_at: string
    /** When the unspent part expires. */
    readonly expires_at: string
    /** The credits still unspent. */
    readonly credits_remaining: number
}
