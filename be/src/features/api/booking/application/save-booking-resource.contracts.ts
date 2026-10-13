/** Input for save-booking-resource. */
export interface SaveBookingResourceRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The existing resource id, or null to create one. */
    readonly id: string | null
    /** The resource display name. */
    readonly name: string
    /** The resource kind. */
    readonly kind: string
    /** The number of guests the resource can accommodate. */
    readonly capacity: number
    /** Whether the resource is available for bookings. */
    readonly active: boolean
    /** The linked staff id, or null when no staff member is assigned. */
    readonly staffId: string | null
}

/** Catalog identity returned after creating or updating a bookable resource. */
export interface SaveBookingResourceResult {
    /** Use this value to select the refreshed resource in the booking catalog. */
    readonly id: string
}
