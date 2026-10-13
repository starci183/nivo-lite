/** The queue name: the contract between the AFTER trigger of `bookings` (which sends through job_enqueue) and the processor of the apply-booking-status job (a pgmq queue name). */
export const BOOKING_STATUS_QUEUE = "booking_status"

/** The kinds of change the trigger reports. */
export type BookingStatusKind = "created" | "status" | "moved"

/** The payload of one booking change: ids and codes only; the job reads the booking itself. An unreadable field comes out empty. */
export interface BookingStatusPayload {
    /** The workspace of the booking. */
    readonly workspaceId: string
    /** The booking that changed. */
    readonly bookingId: string
    /** What kind of change it was. */
    readonly kind: BookingStatusKind
}

const KINDS: ReadonlyArray<BookingStatusKind> = ["created", "status", "moved"]

/** Reads a job payload as a booking change: unknown fields are dropped and a malformed field is empty. */
export const bookingStatusPayloadOf = (value: object): BookingStatusPayload => ({
    workspaceId: "workspaceId" in value && typeof value.workspaceId === "string" ? value.workspaceId : "",
    bookingId: "bookingId" in value && typeof value.bookingId === "string" ? value.bookingId : "",
    kind: KINDS.find((kind) => "kind" in value && kind === value.kind) ?? "status",
})
