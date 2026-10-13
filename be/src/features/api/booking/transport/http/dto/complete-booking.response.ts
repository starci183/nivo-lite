/** The HTTP answer of complete-booking. */
export class CompleteBookingResponse {
    /** The status. */
    status!: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

    /** The fee due. */
    feeDue!: boolean
}
