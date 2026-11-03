import { AGENT_TAG_VISIBILITY } from "@modules/domain/agent-work"
import { AgentTagConversationService } from "./agent-tag-conversation.service"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-messages.module-definition"
import { OFFICE_ROOMS_TEST_CHATS } from "@modules/domain/office-rooms"
import { AgentMessageDeliveriesService } from "./agent-message-deliveries.service"
import { AgentMessagesFeedReadService } from "./agent-messages-feed-read.service"
import { AgentMessageCursorsService } from "./agent-message-cursors.service"
import { AgentMessagesReadService } from "./agent-messages-read.service"
import { AgentMessagesAutomationReadService } from "./agent-messages-automation-read.service"
import { AgentMessagesService } from "./agent-messages.service"
import { AgentTestChatsService } from "./agent-test-chats.service"

@Module({})
/** The messages of a customer conversation, over the primary PostgreSQL connection. */
export class AgentMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app; the read-only mode registers the message feed read alone. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        if (options.readOnly === true) {
            return {
                ...base,
                providers: [...(base.providers ?? []), AgentMessagesFeedReadService],
                exports: [AgentMessagesFeedReadService],
            }
        }
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AgentMessagesService,
                AgentMessagesReadService,
                AgentMessagesAutomationReadService,
                AgentMessageCursorsService,
                AgentMessageDeliveriesService,
                AgentMessagesFeedReadService,
                AgentTestChatsService,
                AgentTagConversationService,
                { provide: AGENT_TAG_VISIBILITY, useExisting: AgentTagConversationService },
                { provide: OFFICE_ROOMS_TEST_CHATS, useExisting: AgentTestChatsService },
            ],
            exports: [
                AgentMessagesService,
                AgentMessagesReadService,
                AgentMessagesAutomationReadService,
                AgentMessageCursorsService,
                AgentMessageDeliveriesService,
                AgentMessagesFeedReadService,
                AgentTestChatsService,
                AGENT_TAG_VISIBILITY,
                OFFICE_ROOMS_TEST_CHATS,
            ],
        }
    }
}
