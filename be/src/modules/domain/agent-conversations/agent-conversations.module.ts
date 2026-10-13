import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-conversations.module-definition"
import { AgentConversationsService } from "./agent-conversations.service"

@Module({})
/** The conversations customers have with the workspace's agents, over the primary Supabase PostgreSQL connection. */
export class AgentConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentConversationsService],
            exports: [AgentConversationsService],
        }
    }
}
