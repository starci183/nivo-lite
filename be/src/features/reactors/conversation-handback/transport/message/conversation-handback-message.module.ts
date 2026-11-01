import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { DEAL_WON_CONVERSATION_HANDBACK_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { ConversationHandbackModule } from "../../conversation-handback.module"
import { DealWonConsumer } from "./deal-won.consumer"
import { ConfigurableModuleClass } from "./conversation-handback-message.module-definition"

@Module({
    imports: [ConversationHandbackModule.register({})],
    providers: [DealWonConsumer],
})
/** The message transport of the conversation-handback reactor: subscribes its consumer to its queue; the api app composes it. */
export class ConversationHandbackMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly dealWonConsumer: DealWonConsumer,
    ) {
        super()
    }

    /** The subscription is static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(DEAL_WON_CONVERSATION_HANDBACK_TOPIC_QUEUE, this.dealWonConsumer)
    }
}
