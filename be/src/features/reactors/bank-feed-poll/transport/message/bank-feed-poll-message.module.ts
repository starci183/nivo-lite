import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { BankFeedPollReactorModule } from "../../bank-feed-poll.module"
import { ConfigurableModuleClass } from "./bank-feed-poll-message.module-definition"
import { ConnectionReadyConsumer } from "./connection-ready.consumer"

@Module({ imports: [BankFeedPollReactorModule.register({})], providers: [ConnectionReadyConsumer] })
/** The message transport of the bank-feed-poll reactor: subscribes its consumer to its queue; the api app composes it. */
export class BankFeedPollMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly connectionReadyConsumer: ConnectionReadyConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(CONNECTION_READY_BANK_FEED_POLL_TOPIC_QUEUE, this.connectionReadyConsumer)
    }
}
