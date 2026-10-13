import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TelegramClient } from "./telegram.client"
import { TELEGRAM } from "./telegram.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram.module-definition"

@Module({})
/** Provides the Telegram client. */
export class TelegramModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that talks to Telegram. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: TELEGRAM, useClass: TelegramClient }],
            exports: [TELEGRAM],
        }
    }
}
