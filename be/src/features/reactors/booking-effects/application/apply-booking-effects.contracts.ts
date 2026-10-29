import type { BookingEffectsService } from "@modules/domain/bookings"
import type { BookingStatusChangedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"

/** What applying one delivered booking_status_changed event takes. */
export interface ApplyBookingEffectsRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The delivery: the domain service claims its consumer and dedupe key in the inbox inside its own transaction. */
    readonly delivery: EventDelivery<BookingStatusChangedEvent>
}

/** What the booking effects service answers for one delivery. */
export type ApplyBookingEffectsResult = Awaited<ReturnType<BookingEffectsService["apply"]>>
