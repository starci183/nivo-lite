import { Injectable } from "@nestjs/common"
import { DealWonEvent } from "@modules/events/api"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { AutomationReactionsService } from "../automation-reactions.service"

@Injectable()
/** The thin door of the automations reactor of `deal_won`: it hands each delivery to one command. */
export class DealWonConsumer implements EventConsumer<DealWonEvent> {
    readonly event = DealWonEvent

    constructor(private readonly reactions: AutomationReactionsService) {}

    /** Dispatches the delivery; a throw leaves the message to reappear after its visibility timeout. */
    handle(delivery: EventDelivery<DealWonEvent>): Promise<void> {
        return this.reactions.onDealWon(delivery)
    }
}
