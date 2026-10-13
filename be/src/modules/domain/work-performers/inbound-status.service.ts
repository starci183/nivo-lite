import { Injectable } from "@nestjs/common"
import type { InboundEventStatus, InboundStatus, WorkContext } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalLeadRef } from "@modules/domain/inbound-events"

@Injectable()
/** The inbound event status the work engine reports through: where an input stands once the engine worked on it. */
export class InboundStatusService implements InboundEventStatus {
    constructor(private readonly events: InboundEventsService) {}

    /** Sets the status of an inbound event and links the customer the engine found, when there is one. */
    mark(ctx: WorkContext, inboundEventId: string, status: InboundStatus, leadId: OptionalLeadRef): Promise<void> {
        return this.events.mark(ctx.workspaceId, inboundEventId, status, leadId)
    }
}
