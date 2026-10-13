/** What complete-booking takes. */
export interface CompleteBookingRequest {
    /** The workspace id. */
    readonly workspaceId: string
    /** The id. */
    readonly id: string
}

/** What complete-booking answers. */
export interface CompleteBookingResult {
    /** The status. */
    readonly status: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"
    /** The fee due. */
    readonly feeDue: boolean
}
