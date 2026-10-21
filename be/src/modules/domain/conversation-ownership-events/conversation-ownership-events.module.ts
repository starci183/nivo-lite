import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./conversation-ownership-events.module-definition"
import { ConversationOwnershipEventsService } from "./conversation-ownership-events.service"

@Module({})
/** The history of who owned a customer conversation: every move between the Sales and the Customer care agent. */
export class ConversationOwnershipEventsModule extends ConfigurableModuleClass {
    /** Registers the capability under the capability that moves conversations. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ConversationOwnershipEventsService],
            exports: [ConversationOwnershipEventsService],
        }
    }
}
