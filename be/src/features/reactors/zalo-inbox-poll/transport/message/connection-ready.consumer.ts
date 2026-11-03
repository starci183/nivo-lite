import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { ConnectionReadyEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { StartZaloInboxPollCommand } from "../../application/start-zalo-inbox-poll.command"

@Injectable()
/** The consumer door of the connection_ready event in the zalo-inbox-poll reactor: it dispatches one command and forwards the event id. */
export class ConnectionReadyConsumer implements EventConsumer<ConnectionReadyEvent> {
    readonly event: typeof ConnectionReadyEvent = ConnectionReadyEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the poll job the command enqueues carries a dedupe key, so a repeat is one job. */
    async handle(delivery: EventDelivery<ConnectionReadyEvent>): Promise<void> {
        await this.commandBus.execute(
            new StartZaloInboxPollCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
