import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { DealWonEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { HandBackConversationCommand } from "../../application/hand-back-conversation.command"

@Injectable()
/** The consumer door of the deal_won event in the conversation-handback reactor: it dispatches one command and forwards the event id. */
export class DealWonConsumer implements EventConsumer<DealWonEvent> {
    readonly event = DealWonEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<DealWonEvent>): Promise<void> {
        await this.commandBus.execute(
            new HandBackConversationCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
