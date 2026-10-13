/** The HTTP answer of check-in-booking. */
export class CheckInBookingResponse {
    /** The status. */
    status!: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

    /** The fee due. */
    feeDue!: boolean
}
