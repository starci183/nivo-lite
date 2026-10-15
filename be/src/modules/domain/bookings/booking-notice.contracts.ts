/** The kinds of line a customer is sent about a booking. */
export type BookingNoticeKind = "confirmed" | "moved" | "cancelled" | "no_show" | "reminder"

/** One line to the customer about a booking: where it goes is decided from the booking, not from the chat it came from alone. */
export interface BookingNotice {
    /** The workspace. */
    readonly workspaceId: string
    /** The booking the line is about. */
    readonly bookingId: string
    /** What kind of line it is. */
    readonly kind: BookingNoticeKind
    /** The customer record, or null. */
    readonly leadId: string | null
    /** The conversation the booking came from, or null (a public-page booking has none). */
    readonly conversationId: string | null
    /** The customer's email address, or null. */
    readonly email: string | null
    /** The subject when the line goes out as an email. */
    readonly subject: string
    /** What to say. */
    readonly text: string
    /** Unique per line: the same key never goes out twice. */
    readonly dedupeKey: string
    /** The work item that allowed the line, when one did. */
    readonly workItemId?: string | null
}

/** What became of a notice. */
export interface BookingNoticeResult {
    /** True when the customer's channel accepted the line. */
    readonly delivered: boolean
    /** True when the line was stored or queued somewhere, so repeating the attempt would double it. */
    readonly kept: boolean
    /** The way it left: a channel key, `email` or `none`. */
    readonly via: string
}

/** Carries a notice to the customer: their conversation, else their latest conversation, else email. */
export interface BookingNotifier {
    /** Delivers one notice. */
    notify(notice: BookingNotice): Promise<BookingNoticeResult>
}
