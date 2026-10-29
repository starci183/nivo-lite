import type { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import type { EventDelivery } from "@modules/platform/event-bus"

/** What applying one delivered knowledge_source_indexed event takes. */
export interface QueueSourceFactsRequest {
    /** The originating request identity retained by the delivery envelope. */
    readonly correlationId: string
    /** The id of the delivered event. */
    readonly eventId: string
    /** The delivery: the domain service claims its consumer and dedupe key in the inbox inside its own transaction. */
    readonly delivery: EventDelivery<KnowledgeSourceIndexedEvent>
}
