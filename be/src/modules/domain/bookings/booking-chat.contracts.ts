/** The chat a booking request came from, so its notices are answered there. */
export interface ChatLink {
    /** The conversation, or null. */
    readonly conversationId: string | null
    /** The customer lead of that chat, when known. */
    readonly leadId: string | null
}

/** The chat a customer asks about their booking in. */
export interface ChatBookingRef {
    /** The workspace. */
    readonly workspaceId: string
    /** The customer lead of the chat, or null. */
    readonly leadId: string | null
    /** The conversation. */
    readonly conversationId: string
}

/** The next future booking for which a customer may ask the owner to cancel. */
export interface CancellableBooking {
    /** The booking to identify in the owner's decision. */ readonly id: string
    /** The customer lead, when linked. */ readonly leadId: string | null
    /** The future start instant, ISO 8601. */ readonly startIso: string
    /** The service name for the owner's decision. */ readonly serviceName: string
    /** The customer name for the owner's decision. */ readonly customerName: string
}
/** A next cancellable booking, or none when no future request or confirmation matches. */
export type OptionalCancellableBooking = CancellableBooking | null
