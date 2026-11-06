import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChannelSendExecutorService } from "./channel-send-executor.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-node-ports.module-definition"
import { KnowledgeNodePortService } from "./knowledge-node-port.service"

@Module({})
/**
 * What the chat serves to the graph nodes: the data port of the knowledge-document kind and the executor of `channel.send`, each
 * registered with the graph-nodes registry. The conversation and message kinds are served by the entity engine.
 */
export class ChatNodePortsModule extends ConfigurableModuleClass {
    /** Registers the capability in the app that runs graph nodes. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), KnowledgeNodePortService, ChannelSendExecutorService],
        }
    }
}
