import { Module, type OnModuleInit } from "@nestjs/common"
import {
    INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE,
    InjectEventConsumerRegistry,
    KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE,
    type EventConsumerRegistry,
} from "@modules/platform/event-bus"
import { AgentWakesModule } from "../../agent-wakes.module"
import { InstallationChangedConsumer } from "./installation-changed.consumer"
import { KnowledgeSourceIndexedConsumer } from "./knowledge-source-indexed.consumer"
import { ConfigurableModuleClass } from "./agent-wakes-message.module-definition"

@Module({
    imports: [AgentWakesModule.register({})],
    providers: [
        KnowledgeSourceIndexedConsumer,
        InstallationChangedConsumer,
    ],
})
/** The message transport of the agent-wakes reactor: subscribes its consumers to their queues; the api app composes it. */
export class AgentWakesMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly knowledgeSourceIndexedConsumer: KnowledgeSourceIndexedConsumer,
        private readonly installationChangedConsumer: InstallationChangedConsumer,
    ) {
        super()
    }

    /** The subscriptions are static: one literal queue constant per consumer. */
    onModuleInit(): void {
        this.consumers.subscribe(KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE, this.knowledgeSourceIndexedConsumer)
        this.consumers.subscribe(INSTALLATION_CHANGED_AGENT_WAKES_TOPIC_QUEUE, this.installationChangedConsumer)
    }
}
