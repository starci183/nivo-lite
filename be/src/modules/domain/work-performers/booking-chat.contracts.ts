/** What a customer asked about an appointment, as the chat reply named it ("booking_request" of the reply contract). */
export type ChatBookingIntent = "book" | "reschedule" | "cancel" | "availability" | "waitlist"

/** One structured booking request of a chat reply, read and bounded. */
export interface ChatBookingRequest {
    /** What the customer wants. */
    readonly intent: ChatBookingIntent
    /** The service as the customer named it; may be empty for a change or a cancellation. */
    readonly service: string
    /** The local day, YYYY-MM-DD, or null. */
    readonly date: string | null
    /** The local time, HH:MM, or null. */
    readonly time: string | null
    /** The start of a period the customer named (afternoon...), HH:MM, or null. */
    readonly from: string | null
    /** The end of that period, HH:MM, or null. */
    readonly to: string | null
    /** How many people come. */
    readonly partySize: number
    /** The customer's name, or empty. */
    readonly name: string
    /** The customer's phone, or null. */
    readonly phone: string | null
    /** The customer's email, or null. */
    readonly email: string | null
    /** What the customer added, or null. */
    readonly note: string | null
}

/** The chat a booking request came from. */
export interface BookingChatTurn {
    /** The workspace. */
    readonly workspaceId: string
    /** The conversation. */
    readonly conversationId: string
    /** The customer lead of the conversation, or null. */
    readonly leadId: string | null
    /** The customer message the request answers: the key that makes a repeat harmless. */
    readonly messageId: string
    /** The name the chat knows the customer by, or empty. */
    readonly visitorName: string
    /** The request. */
    readonly request: ChatBookingRequest
}

/** What a booking request came to: the line that replaces the chat's neutral reply, or null to keep it (a notice follows by itself). */
export interface BookingChatAnswer {
    /** The reply, or null. */
    readonly reply: string | null
    /** What happened, for the evidence. */
    readonly state: string
}
