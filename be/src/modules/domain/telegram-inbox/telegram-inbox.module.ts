import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram-inbox.module-definition"
import { TelegramInboxService } from "./telegram-inbox.service"

@Module({})
/** The durable inbox of the telegram-inbox webhook, over the primary Supabase PostgreSQL connection. */
export class TelegramInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), TelegramInboxService],
            exports: [TelegramInboxService],
        }
    }
}
