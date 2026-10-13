/** The services of get booking page, as a named part. */
export class GetBookingPageServicesResponse {
    /** The id. */
    id!: string

    /** The name. */
    name!: string

    /** The description. */
    description!: string

    /** The duration min. */
    durationMin!: number

    /** The price vnd. */
    priceVnd!: number | null
}

/** The HTTP answer of get-booking-page. */
export class GetBookingPageResponse {
    /** The shop. */
    shop!: string

    /** The slug. */
    slug!: string

    /** The note. */
    note!: string

    /** The address. */
    address!: string

    /** The timezone. */
    timezone!: string

    /** The services. */
    services!: ReadonlyArray<GetBookingPageServicesResponse>
}
