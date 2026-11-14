import { Module, type DynamicModule } from "@nestjs/common"
import { CHAT_FILES_ASSETS, CHAT_FILES_STORAGE } from "./chat-files.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-files.module-definition"
import { CustomerFilesService } from "./customer-files.service"

@Module({})
/** The pictures and files customers send on a channel: the shop keeps a checked copy and hands its bytes to a model call. */
export class ChatFilesModule extends ConfigurableModuleClass {
    /** Registers the storage binding and service once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: CHAT_FILES_STORAGE, useExisting: options.storage },
                ...(options.assets === undefined ? [] : [{ provide: CHAT_FILES_ASSETS, useExisting: options.assets }]),
                CustomerFilesService,
            ],
            exports: [CustomerFilesService],
        }
    }
}
