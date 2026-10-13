/** Input for remove-booking-exception. */
export interface RemoveBookingExceptionRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The booking setup row to remove. */
    readonly id: string
}

/** Acknowledges removal of an exceptional opening or closure. */
export interface RemoveBookingExceptionResult {
    /** Use this value to discard the removed calendar override locally. */
    readonly id: string
}
