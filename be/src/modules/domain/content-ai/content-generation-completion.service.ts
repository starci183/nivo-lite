import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import { AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { ContentAiService } from "./content-ai.service"

@Injectable()
/**
 * The thin door of the `content` reactor of `ai_generation_completed`: it applies a finished marketing generation to the content
 * capability that requested it. The content capability ignores a generation it does not own.
 */
export class ContentGenerationCompletionService implements EventConsumer<AiGenerationCompletedEvent>, OnModuleInit {
    readonly event = AiGenerationCompletedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly content: ContentAiService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE, this)
    }

    /** Applies the generation that ended, once per delivery key. */
    handle(delivery: EventDelivery<AiGenerationCompletedEvent>): Promise<void> {
        const { workspaceId, generationId } = delivery.event.payload
        return this.content.complete(workspaceId, generationId, {
            consumer: delivery.consumer,
            dedupeKey: delivery.dedupeKey,
        })
    }
}
