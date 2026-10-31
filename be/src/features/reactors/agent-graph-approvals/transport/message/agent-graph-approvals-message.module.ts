import { Module } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { APPROVAL_RESOLVED_AGENT_GRAPHS_TOPIC_QUEUE, InjectEventConsumerRegistry } from "@modules/platform/event-bus"
import type { EventConsumerRegistry } from "@modules/platform/event-bus"
import { AgentGraphApprovalsModule } from "../../agent-graph-approvals.module"
import { ApprovalResolvedConsumer } from "./approval-resolved.consumer"
import { ConfigurableModuleClass } from "./agent-graph-approvals-message.module-definition"

@Module({ imports: [AgentGraphApprovalsModule.register({})], providers: [ApprovalResolvedConsumer] })
/** The message transport of the agent graph approvals reactor: subscribes its consumer to its queue; the api app composes it. */
export class AgentGraphApprovalsMessageModule extends ConfigurableModuleClass implements OnModuleInit {
    constructor(
        @InjectEventConsumerRegistry() private readonly consumers: EventConsumerRegistry,
        private readonly approvalResolvedConsumer: ApprovalResolvedConsumer,
    ) {
        super()
    }

    /** The subscription is static: one literal queue constant. */
    onModuleInit(): void {
        this.consumers.subscribe(APPROVAL_RESOLVED_AGENT_GRAPHS_TOPIC_QUEUE, this.approvalResolvedConsumer)
    }
}
