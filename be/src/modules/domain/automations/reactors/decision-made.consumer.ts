import { Injectable } from "@nestjs/common"
import { DecisionMadeEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `decision_made`: it hands each delivery to one command. */
export class DecisionMadeConsumer implements EventConsumer<DecisionMadeEvent> {
    readonly event = DecisionMadeEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<DecisionMadeEvent>): Promise<void> {
        return this.reactions.onDecisionMade(delivery)
    }
}
