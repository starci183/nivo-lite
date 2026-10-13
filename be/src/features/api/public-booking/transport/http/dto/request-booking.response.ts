/** The HTTP answer of request-booking. */
export class RequestBookingResponse {
    /** The ok. */
    ok!: boolean

    /** The state. */
    state!: "confirmed" | "waiting" | "invalid" | "failed"

    /** The code. */
    code!:
        | "name_required"
        | "phone_invalid"
        | "start_invalid"
        | "service_unavailable"
        | "confirmed"
        | "received_free"
        | "received_taken"
        | "no_resource"

    /** The service name. */
    serviceName!: string

    /** The start iso. */
    startIso!: string

    /** The alternatives. */
    alternatives!: ReadonlyArray<string>

    /** The booking id. */
    bookingId!: string | null
}
