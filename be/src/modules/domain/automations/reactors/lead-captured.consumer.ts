import { Injectable } from "@nestjs/common"
import { LeadCapturedEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `lead_captured`: it hands each delivery to one command. */
export class LeadCapturedConsumer implements EventConsumer<LeadCapturedEvent> {
    readonly event = LeadCapturedEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<LeadCapturedEvent>): Promise<void> {
        return this.reactions.onLeadCaptured(delivery)
    }
}
