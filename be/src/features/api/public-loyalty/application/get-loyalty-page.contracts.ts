/** What get-loyalty-page takes. */
export interface GetLoyaltyPageRequest {
    /** The slug. */
    readonly slug: string
}

/** What get-loyalty-page answers. */
export interface GetLoyaltyPageResult {
    /** The slug. */
    readonly slug: string
    /** The shop. */
    readonly shop: string
    /** The name. */
    readonly name: string
}
