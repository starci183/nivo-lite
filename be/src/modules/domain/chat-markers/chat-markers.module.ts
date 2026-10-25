import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./chat-markers.module-definition"
import { ChatMarkersService } from "./chat-markers.service"

@Module({})
/** Member delivery cursors, room/conversation read receipts and per-target mute preferences. */
export class ChatMarkersModule extends ConfigurableModuleClass {
    /** Registers the shared capability for API application features. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), ChatMarkersService], exports: [ChatMarkersService] }
    }
}
