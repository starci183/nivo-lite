import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AGENT_DIRECTORY } from "./office-lines.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./messages.module-definition"
import { MessageCursorsService } from "./message-cursors.service"
import { MessagesReadService } from "./messages-read.service"
import { MessagesService } from "./messages.service"
import { OfficeCardsService } from "./office-cards.service"
import { OfficeLinesService } from "./office-lines.service"
import { TeamChatService } from "./team-chat.service"

@Module({})
/** The team chat of a workspace and the Office thread. The agent directory is bound by the app root through the options. */
export class MessagesModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: AGENT_DIRECTORY, useExisting: options.agentDirectory },
                MessagesService,
                MessagesReadService,
                MessageCursorsService,
                OfficeLinesService,
                OfficeCardsService,
                TeamChatService,
            ],
            exports: [MessagesService, MessagesReadService, MessageCursorsService, OfficeLinesService, OfficeCardsService, TeamChatService],
        }
    }
}
