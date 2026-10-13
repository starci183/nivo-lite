/** The queue name: the contract between the AFTER trigger of `bookings` (which sends through job_enqueue) and the processor of the apply-booking-status job (a pgmq queue name). */
export const BOOKING_STATUS_QUEUE = "booking_status"

/** The kinds of change the trigger reports. */
export type BookingStatusKind = "created" | "status" | "moved"

/** The payload of one booking change: ids and codes only; the job reads the booking itself. */
export interface BookingStatusPayload {
    /** The workspace of the booking. */
    readonly workspaceId: string
    /** The booking that changed. */
    readonly bookingId: string
    /** What kind of change it was. */
    readonly kind: BookingStatusKind
}

const KINDS: ReadonlyArray<string> = ["created", "status", "moved"]

/** Reads a job payload as a booking change, or null when it is not one. */
export const bookingStatusPayloadOf = (value: object): BookingStatusPayload | null => {
    if (!("workspaceId" in value) || typeof value.workspaceId !== "string") return null
    if (!("bookingId" in value) || typeof value.bookingId !== "string") return null
    if (!("kind" in value) || typeof value.kind !== "string" || !KINDS.includes(value.kind)) return null
    return { workspaceId: value.workspaceId, bookingId: value.bookingId, kind: value.kind as BookingStatusKind }
}
