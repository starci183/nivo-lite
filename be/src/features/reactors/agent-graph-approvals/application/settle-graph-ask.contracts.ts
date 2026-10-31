import type { ApprovalResolvedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"

/** What settling the ask of one delivered approval_resolved event takes. */
export interface SettleGraphAskRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The delivery. */
    readonly delivery: EventDelivery<ApprovalResolvedEvent>
}
