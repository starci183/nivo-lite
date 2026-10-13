/** What request-booking takes. */
export interface RequestBookingRequest {
    /** The slug. */
    readonly slug: string
    /** The service id. */
    readonly serviceId: string
    /** The start. */
    readonly start: string
    /** The name. */
    readonly name: string
    /** The phone. */
    readonly phone: string
    /** The email. */
    readonly email: string
    /** The party. */
    readonly party: number
    /** The note. */
    readonly note: string
    /** The token. */
    readonly token: string
    /** The website. */
    readonly website: string
}

/** What request-booking answers. */
export interface RequestBookingResult {
    /** The ok. */
    readonly ok: boolean
    /** The state. */
    readonly state: "confirmed" | "waiting" | "invalid" | "failed"
    /** The code. */
    readonly code:
        | "name_required"
        | "phone_invalid"
        | "start_invalid"
        | "service_unavailable"
        | "confirmed"
        | "received_free"
        | "received_taken"
        | "no_resource"
    /** The service name. */
    readonly serviceName: string
    /** The start iso. */
    readonly startIso: string
    /** The alternatives. */
    readonly alternatives: ReadonlyArray<string>
    /** The booking id. */
    readonly bookingId: string | null
}
