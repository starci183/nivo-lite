import { Module, type DynamicModule } from "@nestjs/common"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-node-ports.module-definition"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"

@Module({})
/**
 * What the chat serves to the graphs: for the nodes the data port of the knowledge-document kind and the one customer send (`nivo.tool.customer.message.send`) registered with the graph-nodes registry. Whether the owner approves a send first is the tool door's generic approval, not this module's. The conversation and message kinds are served by the entity engine.
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
                ChannelSendExecutorService,
            ],
        }
    }
}
