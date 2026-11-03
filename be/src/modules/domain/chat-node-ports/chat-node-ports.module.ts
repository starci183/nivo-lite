import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-node-ports.module-definition"
import { ConversationNodePortService } from "./conversation-node-port.service"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"
import { MessageNodePortService } from "./message-node-port.service"

@Module({})
/**
 * What the chat serves to the graph nodes: the data ports of the conversation, message and knowledge-document kinds and the executor of
 * `channel.send`, each registered with the graph-nodes registry over the services that already own the records and the outbound path.
 */
export class ChatNodePortsModule extends ConfigurableModuleClass {
    /** Registers the capability in the app that runs graph nodes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ConversationNodePortService,
                MessageNodePortService,
                KnowledgeNodePortService,
                ChannelSendExecutorService,
            ],
        }
    }
}
