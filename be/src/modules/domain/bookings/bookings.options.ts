import type { BookingNotifier } from "./bookings.contracts"

/** What the booking capability takes from the app root. */
export interface BookingsOptions {
    /** Carries the notice of a confirmed, moved or cancelled booking into the chat of the customer; without it no notice is sent. */
    readonly notifier?: BookingNotifier
}
