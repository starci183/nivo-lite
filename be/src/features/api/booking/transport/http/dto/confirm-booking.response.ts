/** The HTTP answer of confirm-booking. */
export class ConfirmBookingResponse {
    /** The status. */
    status!: "requested" | "confirmed" | "rescheduled" | "cancelled" | "no_show" | "done"

    /** The fee due. */
    feeDue!: boolean
}
