import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { DecisionMadeEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { ReactToDecisionMadeCommand } from "../../application/react-to-decision-made.command"

@Injectable()
/** The consumer door of the decision_made event in the automation-triggers reactor: it dispatches one command and forwards the event id. */
export class DecisionMadeConsumer implements EventConsumer<DecisionMadeEvent> {
    readonly event = DecisionMadeEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<DecisionMadeEvent>): Promise<void> {
        await this.commandBus.execute(
            new ReactToDecisionMadeCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
