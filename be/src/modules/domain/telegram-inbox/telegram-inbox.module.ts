import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./telegram-inbox.module-definition"
import { TELEGRAM_RECEIPT_PROCESSOR } from "./telegram-inbox.decorators"
import { TelegramDeliveryService } from "./telegram-delivery.service"
import { TelegramInboxService } from "./telegram-inbox.service"

@Module({})
/** The durable inbox of the telegram-inbox webhook, over the primary PostgreSQL connection. */
export class TelegramInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                TelegramInboxService,
                TelegramDeliveryService,
                { provide: TELEGRAM_RECEIPT_PROCESSOR, useExisting: TelegramInboxService },
            ],
            exports: [TelegramInboxService, TelegramDeliveryService],
        }
    }
}
