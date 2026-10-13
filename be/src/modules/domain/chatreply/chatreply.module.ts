import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chatreply.module-definition"
import { ChatReplyService } from "./chatreply.service"
import { ChatReplyStatusService } from "./chatreply-status.service"

@Module({})
/** Customer replies use the existing chat-turn and decision job producers. */
export class ChatReplyModule extends ConfigurableModuleClass {
    /** Registers the orchestration and status readers once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ChatReplyService, ChatReplyStatusService],
            exports: [ChatReplyService, ChatReplyStatusService],
        }
    }
}
