/** What get-booking-page takes. */
export interface GetBookingPageRequest {
    /** The slug. */
    readonly slug: string
}

/** The services of get booking page, as a named part. */
export interface GetBookingPageServicesResult {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The description. */
    readonly description: string
    /** The duration min. */
    readonly durationMin: number
    /** The price vnd. */
    readonly priceVnd: number | null
}

/** What get-booking-page answers. */
export interface GetBookingPageResult {
    /** The shop. */
    readonly shop: string
    /** The slug. */
    readonly slug: string
    /** The note. */
    readonly note: string
    /** The address. */
    readonly address: string
    /** The timezone. */
    readonly timezone: string
    /** The services. */
    readonly services: ReadonlyArray<GetBookingPageServicesResult>
}
