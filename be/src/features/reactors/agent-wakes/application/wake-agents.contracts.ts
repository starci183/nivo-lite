import type { EventClaim, InternalEventFact } from "@modules/domain/agent-schedules"

/** What waking the agents of one delivered internal event takes. */
export interface WakeAgentsRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The fact the event announces. */
    readonly fact: InternalEventFact
    /** The delivery's inbox key: the domain service claims it inside its own transaction. */
    readonly claim: EventClaim
}
