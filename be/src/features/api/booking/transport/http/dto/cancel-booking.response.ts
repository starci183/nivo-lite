/** The HTTP answer of cancel-booking. */
export class CancelBookingResponse {
    /** The status. */
    status!: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

    /** The fee due. */
    feeDue!: boolean
}
