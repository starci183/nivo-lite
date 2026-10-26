import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ChatActivityService } from "./chat-activity.service"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-activity.module-definition"

@Module({})
/** Pushes small chat notification frames (message, receipt, unread) to the active members of a workspace. */
export class ChatActivityModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChatActivityService],
            exports: [ChatActivityService],
        }
    }
}
