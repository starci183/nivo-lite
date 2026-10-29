import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./agent-messages.module-definition"
import { OFFICE_ROOMS_TEST_CHATS } from "@modules/domain/office-rooms"
import { AgentMessageDeliveriesService } from "./agent-message-deliveries.service"
import { AgentMessageCursorsService } from "./agent-message-cursors.service"
import { AgentMessagesReadService } from "./agent-messages-read.service"
import { AgentMessagesService } from "./agent-messages.service"
import { AgentTestChatsService } from "./agent-test-chats.service"

@Module({})
/** The messages of a customer conversation, over the primary Supabase PostgreSQL connection. */
export class AgentMessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                AgentMessagesService,
                AgentMessagesReadService,
                AgentMessageCursorsService,
                AgentMessageDeliveriesService,
                AgentTestChatsService,
                { provide: OFFICE_ROOMS_TEST_CHATS, useExisting: AgentTestChatsService },
            ],
            exports: [
                AgentMessagesService,
                AgentMessagesReadService,
                AgentMessageCursorsService,
                AgentMessageDeliveriesService,
                AgentTestChatsService,
                OFFICE_ROOMS_TEST_CHATS,
            ],
        }
    }
}
