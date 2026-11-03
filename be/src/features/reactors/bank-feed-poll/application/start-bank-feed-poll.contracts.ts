import type { ConnectionReadyEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"

/** What starting the first poll of one ready connection takes. */
export interface StartBankFeedPollRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The delivery of the connection_ready event. */
    readonly delivery: EventDelivery<ConnectionReadyEvent>
}
