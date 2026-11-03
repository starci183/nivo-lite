import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { CONNECTION_READY_ZALO_INBOX_POLL_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ZaloInboxPollReactorModule } from "../../zalo-inbox-poll.module"
import { ConfigurableModuleClass } from "./zalo-inbox-poll-message.module-definition"
import { ConnectionReadyConsumer } from "./connection-ready.consumer"

@Module({ imports: [ZaloInboxPollReactorModule.register({})], providers: [ConnectionReadyConsumer] })
/** The message transport of the zalo-inbox-poll reactor: subscribes its consumer to its queue; the api app composes it. */
export class ZaloInboxPollMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly connectionReadyConsumer: ConnectionReadyConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(CONNECTION_READY_ZALO_INBOX_POLL_TOPIC_QUEUE, this.connectionReadyConsumer)
    }
}
