/** Input for remove-booking-resource. */
export interface RemoveBookingResourceRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The booking setup row to remove. */
    readonly id: string
}

/** Catalog target acknowledged after removal or retirement. */
export interface RemoveBookingResourceResult {
    /** Use this value to discard the affected resource from the active catalog. */
    readonly id: string
}
