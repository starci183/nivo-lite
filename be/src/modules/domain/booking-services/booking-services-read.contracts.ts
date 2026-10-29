/** A service of the catalogue as other capabilities read it. */
export interface BookingServiceRecord {
    /** The service id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The description. */
    readonly description: string
    /** The visit length in minutes. */
    readonly durationMin: number
    /** The rest after a visit in minutes. */
    readonly bufferMin: number
    /** The price in VND as a bigint text, or null. */
    readonly priceVnd: string | null
    /** The required resource kind, or null. */
    readonly resourceKind: string | null
    /** The days until the follow-up message, or null. */
    readonly followupDays: number | null
    /** Whether customers can book it. */
    readonly active: boolean
}

/** How long a service holds a resource. */
export interface BookingServiceTiming {
    /** The visit length in minutes. */
    readonly durationMin: number
    /** The rest after a visit in minutes. */
    readonly bufferMin: number
}
