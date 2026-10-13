/** Input for save-booking-exception. */
export interface SaveBookingExceptionRequest {
    /** The workspace that owns these booking settings. */
    readonly workspaceId: string
    /** The affected resource id, or null to apply workspace-wide. */
    readonly resourceId: string | null
    /** The local calendar date of the exception. */
    readonly date: string
    /** Whether bookings are closed for this date. */
    readonly closed: boolean
    /** The opening time when bookings remain available. */
    readonly start: string
    /** The closing time when bookings remain available. */
    readonly end: string
    /** The operator note for the exception. */
    readonly note: string
}

/** Reference returned after adding an exceptional opening or closure. */
export interface SaveBookingExceptionResult {
    /** Use this value to target the calendar override for a later removal. */
    readonly id: string
}
