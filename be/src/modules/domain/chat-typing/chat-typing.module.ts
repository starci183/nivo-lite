import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-typing.module-definition"
import { ChatTypingService } from "./chat-typing.service"

@Module({})
/** Short-lived typing hints for the app's existing room and conversation targets. */
export class ChatTypingModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChatTypingService],
            exports: [ChatTypingService],
        }
    }
}
