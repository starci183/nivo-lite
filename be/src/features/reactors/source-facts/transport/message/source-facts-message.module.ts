import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { SourceFactsModule } from "../../source-facts.module"
import { KnowledgeSourceIndexedConsumer } from "./knowledge-source-indexed.consumer"
import { ConfigurableModuleClass } from "./source-facts-message.module-definition"

@Module({ imports: [SourceFactsModule.register({})], providers: [KnowledgeSourceIndexedConsumer] })
/** The message transport of the source-facts reactor: subscribes its consumers to their queues; the api app composes it. */
export class SourceFactsMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly knowledgeSourceIndexedConsumer: KnowledgeSourceIndexedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE, this.knowledgeSourceIndexedConsumer)
    }
}
