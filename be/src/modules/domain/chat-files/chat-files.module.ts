import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatFileReadsService } from "./chat-file-reads.service"
import { CHAT_FILES_ASSETS, CHAT_FILES_IMPORT_ROOT, CHAT_FILES_READER, CHAT_FILES_RESOLVER, CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-files.module-definition"
import { ChatFilesService } from "./chat-files.service"
import { NodeInboundFileReader } from "./inbound-file.reader"
import { NodeHostResolver } from "./inbound-file.resolver"
import { InboundFilesService } from "./inbound-files.service"

@Module({})
/** The files of a conversation: upload addresses, the check of what was stored, their addresses and bytes, and the files a channel brings in. */
export class ChatFilesModule extends ConfigurableModuleClass {
    /** Registers the storage binding and service once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CHAT_FILES_STORAGE, useExisting: options.storage },
                { provide: CHAT_FILES_ASSETS, useExisting: options.assets },
                { provide: CHAT_FILES_IMPORT_ROOT, useValue: options.importRoot },
                { provide: CHAT_FILES_READER, useClass: NodeInboundFileReader },
                { provide: CHAT_FILES_RESOLVER, useClass: NodeHostResolver },
                ChatFilesService,
                ChatFileReadsService,
                InboundFilesService,
            ],
            exports: [ChatFilesService, ChatFileReadsService, InboundFilesService],
        }
    }
}
