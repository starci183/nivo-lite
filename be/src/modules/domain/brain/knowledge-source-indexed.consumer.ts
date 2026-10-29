import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { KnowledgeSourceIndexedEvent } from "@modules/events/api"
import { InjectEventConsumerRegistry, KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { IndexedSourcesService } from "./indexed-sources.service"

@Injectable()
/** The thin door of the `brain` reactor: it reads `knowledge_source_indexed` and has the fact reading queued with the delivery's key. */
export class KnowledgeSourceIndexedConsumer implements EventConsumer<KnowledgeSourceIndexedEvent>, OnModuleInit {
    readonly event = KnowledgeSourceIndexedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly indexed: IndexedSourcesService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE, this)
    }

    /** Queues the reading of the source's facts. */
    handle(delivery: EventDelivery<KnowledgeSourceIndexedEvent>): Promise<void> {
        const { sourceId, workspaceId, indexedAt } = delivery.event.payload
        return this.indexed.queueFacts({ sourceId, workspaceId }, indexedAt, {
            consumer: delivery.consumer,
            dedupeKey: delivery.dedupeKey,
        })
    }
}
