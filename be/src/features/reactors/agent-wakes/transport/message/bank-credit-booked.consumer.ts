import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { BankCreditBookedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { WakeAgentsCommand } from "../../application/wake-agents.command"

@Injectable()
/** The consumer door of the bank_credit_booked event in the agent-wakes reactor: it names the fact and dispatches one command. */
export class BankCreditBookedConsumer implements EventConsumer<BankCreditBookedEvent> {
    readonly event = BankCreditBookedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<BankCreditBookedEvent>): Promise<void> {
        const { payload } = delivery.event
        await this.commandBus.execute(
            new WakeAgentsCommand({
                request: {
                    eventId: delivery.eventId,
                    correlationId: delivery.correlationId,
                    fact: {
                        workspaceId: payload.workspaceId,
                        eventName: BankCreditBookedEvent.eventName,
                        dedupeKey: payload.dedupeKey,
                        subjectId: payload.inboundEventId,
                    },
                    claim: { consumer: delivery.consumer, dedupeKey: delivery.dedupeKey },
                },
            }),
        )
    }
}
