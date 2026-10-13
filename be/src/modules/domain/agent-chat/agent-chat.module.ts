import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-chat.module-definition"
import { AgentChatService } from "./agent-chat.service"

@Module({})
/** Orchestrates agent chat over existing workspace, agent, conversation and message capabilities. */
export class AgentChatModule extends ConfigurableModuleClass {
    /** Registers the orchestration capability once in the application root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), AgentChatService], exports: [AgentChatService] }
    }
}
