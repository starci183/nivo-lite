import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ContentDraftingModule } from "../../content-drafting.module"
import { AiGenerationCompletedConsumer } from "./ai_generation_completed.consumer"
import { ConfigurableModuleClass } from "./content-drafting-message.module-definition"

@Module({ imports: [ContentDraftingModule.register({})], providers: [AiGenerationCompletedConsumer] })
/** The message transport of the content-drafting reactor: subscribes its consumers to their queues; the api app composes it. */
export class ContentDraftingMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly aiGenerationCompletedConsumer: AiGenerationCompletedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(AI_GENERATION_COMPLETED_CONTENT_TOPIC_QUEUE, this.aiGenerationCompletedConsumer)
    }
}
