/** Input for remove-booking-service. */
export interface RemoveBookingServiceRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The booking setup row to remove. */
    readonly id: string
}

/** Catalog target acknowledged after removal or retirement. */
export interface RemoveBookingServiceResult {
    /** Use this value to discard the affected offer from the active catalog. */
    readonly id: string
}
