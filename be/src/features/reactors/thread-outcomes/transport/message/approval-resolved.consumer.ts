import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { ApprovalResolvedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SettleApprovalOutcomeCommand } from "../../application/settle-approval-outcome.command"

@Injectable()
/** The consumer door of the approval_resolved event in the thread-outcomes reactor: it dispatches one command and forwards the event id. */
export class ApprovalResolvedConsumer implements EventConsumer<ApprovalResolvedEvent> {
    readonly event = ApprovalResolvedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<ApprovalResolvedEvent>): Promise<void> {
        await this.commandBus.execute(
            new SettleApprovalOutcomeCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
