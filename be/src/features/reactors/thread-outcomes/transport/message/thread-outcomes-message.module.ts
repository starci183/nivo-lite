import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ThreadOutcomesModule } from "../../thread-outcomes.module"
import { ApprovalResolvedConsumer } from "./approval_resolved.consumer"
import { ConfigurableModuleClass } from "./thread-outcomes-message.module-definition"

@Module({ imports: [ThreadOutcomesModule.register({})], providers: [ApprovalResolvedConsumer] })
/** The message transport of the thread-outcomes reactor: subscribes its consumers to their queues; the api app composes it. */
export class ThreadOutcomesMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly approvalResolvedConsumer: ApprovalResolvedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(APPROVAL_RESOLVED_THREAD_OUTCOMES_TOPIC_QUEUE, this.approvalResolvedConsumer)
    }
}
