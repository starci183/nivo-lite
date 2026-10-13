/** What cancel-booking takes. */
export interface CancelBookingRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}

/** What cancel-booking answers. */
export interface CancelBookingResult {
    /** The status. */
    readonly status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"
    /** The fee due. */
    readonly feeDue: boolean
}
