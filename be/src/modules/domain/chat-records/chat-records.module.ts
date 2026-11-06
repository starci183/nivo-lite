import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatConversationsService } from "./chat-conversations.service"
import { ChatEntitiesService } from "./chat-entities.service"
import { ChatMessagesService } from "./chat-messages.service"
import { ChatProfilesService } from "./chat-profiles.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-records.module-definition"

@Module({})
/** The conversations and messages of the customers' chats, as records through the entity engine. */
export class ChatRecordsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ChatEntitiesService,
                ChatConversationsService,
                ChatMessagesService,
                ChatProfilesService,
            ],
            exports: [ChatConversationsService, ChatMessagesService, ChatProfilesService],
        }
    }
}
