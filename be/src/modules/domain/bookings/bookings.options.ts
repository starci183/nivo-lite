import type { Type } from "@nestjs/common"
import type { BookingNotifier } from "./booking-notice.contracts"

/** What the booking capability takes from the app root. */
export interface BookingsOptions {
    /** Carries the notice of a confirmed, moved or cancelled booking into the chat of the customer. */
    readonly notifier: Type<BookingNotifier>
}
