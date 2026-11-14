import { Module, type DynamicModule, type OnModuleInit } from "@nestjs/common"
import { triggerDeclarations } from "@modules/domain/provider-triggers"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram-inbox.module-definition"
import { TELEGRAM_RECEIPT_PROCESSOR } from "./telegram-inbox.decorators"
import { TelegramDeliveryService } from "./telegram-delivery.service"
import { TelegramFilesService } from "./telegram-files.service"
import { TelegramInboxService } from "./telegram-inbox.service"
import { TELEGRAM_TRIGGERS } from "./telegram-message.trigger"

@Module({})
/**
 * The Telegram webhook door and its deferred consumer, keeping every update in the connection's account data. Telegram has no provider
 * module of its own: its message trigger is declared here, beside the update's data types, and registered at boot.
 */
export class TelegramInboxModule extends ConfigurableModuleClass implements OnModuleInit {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                TelegramInboxService,
                TelegramFilesService,
                TelegramDeliveryService,
                { provide: TELEGRAM_RECEIPT_PROCESSOR, useExisting: TelegramInboxService },
            ],
            exports: [TelegramInboxService, TelegramDeliveryService],
        }
    }

    /** Registers the bot's message trigger once. */
    onModuleInit(): void {
        triggerDeclarations.register(...TELEGRAM_TRIGGERS)
    }
}
