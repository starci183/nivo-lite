import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatFileReadsService } from "./chat-file-reads.service"
import { CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-files.module-definition"
import { ChatFilesService } from "./chat-files.service"

@Module({})
/** The files of a conversation: upload addresses, the check of what was stored, and their addresses and bytes. */
export class ChatFilesModule extends ConfigurableModuleClass {
    /** Registers the storage binding and service once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CHAT_FILES_STORAGE, useExisting: options.storage },
                ChatFilesService,
                ChatFileReadsService,
            ],
            exports: [ChatFilesService, ChatFileReadsService],
        }
    }
}
