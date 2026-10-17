import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-transactions.module-definition"
import { SepayReviewService } from "./sepay-review.service"
import { SepayTransactionsService } from "./sepay-transactions.service"

@Module({})
/** The sepay-transactions capability over the primary Supabase connection. */
export class SepayTransactionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                SepayTransactionsService,
                SepayReviewService,
            ],
            exports: [SepayTransactionsService, SepayReviewService],
        }
    }
}
