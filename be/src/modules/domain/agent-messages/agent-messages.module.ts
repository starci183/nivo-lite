import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-messages.module-definition"
import { AgentMessagesService } from "./agent-messages.service"

@Module({})
/** The messages of a customer conversation, over the primary Supabase PostgreSQL connection. */
export class AgentMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), AgentMessagesService],
            exports: [AgentMessagesService],
        }
    }
}
