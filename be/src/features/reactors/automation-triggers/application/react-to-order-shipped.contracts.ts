import type { OrderShippedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"

/** What applying one delivered order_shipped event takes. */
export interface ReactToOrderShippedRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The delivery: the domain service claims its consumer and dedupe key in the inbox inside its own transaction. */
    readonly delivery: EventDelivery<OrderShippedEvent>
}
