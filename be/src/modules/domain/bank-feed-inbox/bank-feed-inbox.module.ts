import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./bank-feed-inbox.module-definition"
import { BankFeedReceiptService } from "./bank-feed-inbox.service"

@Module({})
/** The durable inbox of the bank-feed-inbox webhook, over the primary PostgreSQL connection. */
export class BankFeedInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: INBOX, useClass: InboxService }, BankFeedReceiptService],
            exports: [BankFeedReceiptService],
        }
    }
}
