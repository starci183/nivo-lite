import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./team-chat.module-definition"
import { TeamChatFilesService } from "./team-chat-files.service"
import { TEAM_CHAT_STORAGE } from "./team-chat.decorators"
import { TeamChatNativeService } from "./team-chat-native.service"
import { TeamChatService } from "./team-chat.service"

@Module({})
/** The internal team chat: rooms, members, messages, pins and read positions of a workspace. */
export class TeamChatModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...(options.storage === undefined
                    ? []
                    : [{ provide: TEAM_CHAT_STORAGE, useExisting: options.storage }]),
                TeamChatFilesService,
                TeamChatService,
                TeamChatNativeService,
            ],
            exports: [TeamChatService, TeamChatNativeService],
        }
    }
}
