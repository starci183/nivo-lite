import { Injectable } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { EventConsumer, EventDelivery } from "@modules/platform/event-bus"
import { QueueSourceFactsCommand } from "../../application/queue-source-facts.command"

@Injectable()
/** The consumer door of the knowledge_source_indexed event in the source-facts reactor: it dispatches one command and forwards the event id. */
export class KnowledgeSourceIndexedConsumer implements EventConsumer<KnowledgeSourceIndexedEvent> {
    readonly event = KnowledgeSourceIndexedEvent

    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Delivery is at least once: the domain service the command reaches claims the delivery in the inbox inside its own transaction. */
    async handle(delivery: EventDelivery<KnowledgeSourceIndexedEvent>): Promise<void> {
        await this.commandBus.execute(
            new QueueSourceFactsCommand({
                request: { eventId: delivery.eventId, delivery, correlationId: delivery.correlationId },
            }),
        )
    }
}
