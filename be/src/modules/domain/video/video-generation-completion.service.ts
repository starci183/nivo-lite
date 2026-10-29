import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AiGenerationCompletedEvent } from "@modules/events/api"
import { AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumer, EventConsumerRegistry, EventDelivery } from "@modules/platform/event-bus"
import { VideoScriptingService } from "./video-scripting.service"

@Injectable()
/**
 * The thin door of the `video` reactor of `ai_generation_completed`: it applies a finished video-script generation to its project.
 * The video capability ignores a generation it does not own.
 */
export class VideoGenerationCompletionService implements EventConsumer<AiGenerationCompletedEvent>, OnModuleInit {
    readonly event = AiGenerationCompletedEvent

    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly scripting: VideoScriptingService,
    ) {}

    /** Subscribes to the reactor's queue. */
    onModuleInit(): void {
        this.consumers.subscribe(AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE, this)
    }

    /** Applies the generation that ended, once per delivery key. */
    handle(delivery: EventDelivery<AiGenerationCompletedEvent>): Promise<void> {
        const { workspaceId, generationId } = delivery.event.payload
        return this.scripting.complete(workspaceId, generationId, {
            consumer: delivery.consumer,
            dedupeKey: delivery.dedupeKey,
        })
    }
}
