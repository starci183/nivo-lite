import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { ApprovalResolvedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { SettleGraphAskCommand } from "../../application/settle-graph-ask.command"

@Injectable()
/** The consumer door of the approval_resolved event in the agent graph approvals reactor: it dispatches one command and forwards the event id. */
export class ApprovalResolvedConsumer implements EventConsumer<ApprovalResolvedEvent> {
    readonly event = ApprovalResolvedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: settling an ask twice does nothing the second time. */
    async handle(delivery: EventDelivery<ApprovalResolvedEvent>): Promise<void> {
        await this.commandBus.execute(
            new SettleGraphAskCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
