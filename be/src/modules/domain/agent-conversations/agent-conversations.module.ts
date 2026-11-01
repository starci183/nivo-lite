import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConversationOwnershipEventsModule } from "@modules/domain/conversation-ownership-events"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-conversations.module-definition"
import { ConversationHandoverService } from "./conversation-handover.service"
import { AgentConversationReadService } from "./agent-conversation-reads.service"
import { AgentConversationsReadService } from "./agent-conversations-read.service"
import { AgentConversationsAutomationReadService } from "./agent-conversations-automation-read.service"
import { AgentConversationsService } from "./agent-conversations.service"

@Module({})
/** The conversations customers have with the workspace's agents, over the primary Supabase PostgreSQL connection. */
export class AgentConversationsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app; the read-only mode registers the conversation lookups alone. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.readOnly === true) {
            return {
                ...base,
                providers: [...(base.providers ?? []), AgentConversationsReadService],
                exports: [AgentConversationsReadService],
            }
        }
        return {
            ...base,
            imports: [...(base.imports ?? []), ConversationOwnershipEventsModule.register({})],
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                AgentConversationsService,
                ConversationHandoverService,
                AgentConversationReadService,
                AgentConversationsReadService,
                AgentConversationsAutomationReadService,
            ],
            exports: [
                AgentConversationsService,
                ConversationHandoverService,
                AgentConversationReadService,
                AgentConversationsReadService,
                AgentConversationsAutomationReadService,
            ],
        }
    }
}
