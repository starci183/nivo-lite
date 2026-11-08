import { Module, type DynamicModule } from "@nestjs/common"
import { CHAT_ROOM_DIRECTORY, CHAT_ROOM_DIRECTORY_OPTIONS } from "./chat-room-directory.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-room-directory.module-definition"
import { ChatRoomDirectoryService } from "./chat-room-directory.service"

@Module({})
/** The room lookups other capabilities read through: the names of the team-chat groups and who sits in them. */
export class ChatRoomDirectoryModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CHAT_ROOM_DIRECTORY_OPTIONS, useValue: options },
                ChatRoomDirectoryService,
                { provide: CHAT_ROOM_DIRECTORY, useExisting: ChatRoomDirectoryService },
            ],
            exports: [ChatRoomDirectoryService, CHAT_ROOM_DIRECTORY],
        }
    }
}
