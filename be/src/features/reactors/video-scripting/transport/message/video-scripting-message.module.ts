import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { VideoScriptingModule } from "../../video-scripting.module"
import { AiGenerationCompletedConsumer } from "./ai_generation_completed.consumer"
import { ConfigurableModuleClass } from "./video-scripting-message.module-definition"

@Module({ imports: [VideoScriptingModule.register({})], providers: [AiGenerationCompletedConsumer] })
/** The message transport of the video-scripting reactor: subscribes its consumers to their queues; the api app composes it. */
export class VideoScriptingMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly aiGenerationCompletedConsumer: AiGenerationCompletedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(AI_GENERATION_COMPLETED_VIDEO_TOPIC_QUEUE, this.aiGenerationCompletedConsumer)
    }
}
