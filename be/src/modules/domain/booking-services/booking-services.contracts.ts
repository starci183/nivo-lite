/** A service catalogue row saved or locked within its workspace. */
export interface BookingServiceSaved {
    /** The service id. */
    readonly id: string
}

/** Validated fields written by the booking setup coordinator. */
export interface BookingServiceWrite {
    /** The owning workspace. */
    readonly workspaceId: string
    /** The existing service id, or null for creation. */
    readonly id: string | null
    /** The service name. */
    readonly name: string
    /** The service description. */
    readonly description: string
    /** The visit length in minutes. */
    readonly durationMin: number
    /** The rest after a visit in minutes. */
    readonly bufferMin: number
    /** The price in VND, or null. */
    readonly priceVnd: number | null
    /** The required resource kind, or null. */
    readonly resourceKind: string | null
    /** The follow-up delay in days, or null. */
    readonly followupDays: number | null
    /** Whether new visits may use the service. */
    readonly active: boolean
}
