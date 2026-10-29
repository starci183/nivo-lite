import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { LeadCapturedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { ReactToLeadCapturedCommand } from "../../application/react-to-lead-captured.command"

@Injectable()
/** The consumer door of the lead_captured event in the automation-triggers reactor: it dispatches one command and forwards the event id. */
export class LeadCapturedConsumer implements EventConsumer<LeadCapturedEvent> {
    readonly event = LeadCapturedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<LeadCapturedEvent>): Promise<void> {
        await this.commandBus.execute(
            new ReactToLeadCapturedCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
