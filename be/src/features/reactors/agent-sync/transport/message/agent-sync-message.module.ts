import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { AgentSyncModule } from "../../agent-sync.module"
import { InstallationChangedConsumer } from "./installation-changed.consumer"
import { ConfigurableModuleClass } from "./agent-sync-message.module-definition"

@Module({ imports: [AgentSyncModule.register({})], providers: [InstallationChangedConsumer] })
/** The message transport of the agent-sync reactor: subscribes its consumers to their queues; the api app composes it. */
export class AgentSyncMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly installationChangedConsumer: InstallationChangedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(INSTALLATION_CHANGED_AGENT_SYNC_TOPIC_QUEUE, this.installationChangedConsumer)
    }
}
