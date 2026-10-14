import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { TelegramUserClient } from "./telegram-user.client"
import { TELEGRAM_USER } from "./telegram-user.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram-user.module-definition"

@Module({})
/** Provides the personal Telegram client. */
export class TelegramUserModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that syncs a personal Telegram account. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: TELEGRAM_USER, useClass: TelegramUserClient }],
            exports: [TELEGRAM_USER],
        }
    }
}
