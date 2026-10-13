/** What check-in-booking takes. */
export interface CheckInBookingRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}

/** What check-in-booking answers. */
export interface CheckInBookingResult {
    /** The status. */
    readonly status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"
    /** The fee due. */
    readonly feeDue: boolean
}
