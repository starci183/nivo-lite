/** Input for save-booking-service. */
export interface SaveBookingServiceRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The existing service id, or null to create one. */
    readonly id: string | null
    /** The service display name. */
    readonly name: string
    /** The service description. */
    readonly description: string
    /** The service duration in minutes. */
    readonly durationMin: number
    /** The buffer after each booking in minutes. */
    readonly bufferMin: number
    /** The price in VND, or null when no price is set. */
    readonly priceVnd: number | null
    /** The resource kind that can fulfil the service. */
    readonly resourceKind: string
    /** The follow-up delay in days, or null to disable it. */
    readonly followupDays: number | null
    /** Whether the service is available for bookings. */
    readonly active: boolean
}

/** Catalog identity returned after creating or updating an offer. */
export interface SaveBookingServiceResult {
    /** Use this value to select the refreshed offer in the booking catalog. */
    readonly id: string
}
