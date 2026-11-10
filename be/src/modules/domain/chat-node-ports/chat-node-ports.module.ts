import { Module } from "@nestjs/common"
import { GRAPH_FLOW_TRIGGER_MESSAGES } from "@modules/domain/agent-graphs"
import type { DynamicModule } from "@nestjs/common"
import { AuthorityRuleNodePortService } from "./authority-rule-node-port.service"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ChatLineMediaService } from "./chat-line-media.service"
import { CustomerDraftsService } from "./customer-drafts.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-node-ports.module-definition"
import { FlowTriggerMessagesService } from "./flow-trigger-messages.service"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"

@Module({})
/**
 * What the chat serves to the graphs: the customer messages a run's trigger reads (`GRAPH_FLOW_TRIGGER_MESSAGES`), and for the nodes the data port of the knowledge-document kind and the one customer send (`customer.message.send`) registered with the graph-nodes registry, with the drafts it keeps for the owner when a channel asks first. The conversation and message kinds are served by the entity engine.
 */
export class ChatNodePortsModule extends ConfigurableModuleClass {
    /** Registers the capability in the app that runs graph nodes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                KnowledgeNodePortService,
                AuthorityRuleNodePortService,
                ChatLineMediaService,
                ChannelSendExecutorService,
                CustomerDraftsService,
                FlowTriggerMessagesService,
                { provide: GRAPH_FLOW_TRIGGER_MESSAGES, useExisting: FlowTriggerMessagesService },
            ],
            exports: [GRAPH_FLOW_TRIGGER_MESSAGES],
        }
    }
}
