/** Input for remove-booking-waitlist-entry. */
export interface RemoveBookingWaitlistEntryRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The booking setup row to remove. */
    readonly id: string
}

/** Acknowledges cancellation while preserving customer history. */
export interface RemoveBookingWaitlistEntryResult {
    /** Use this value to discard the cancelled request from the active waitlist. */
    readonly id: string
}
