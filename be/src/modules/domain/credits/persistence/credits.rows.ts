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
