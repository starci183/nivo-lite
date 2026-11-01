import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./sepay-transactions.module-definition"
import { SepayReviewService } from "./sepay-review.service"
import { SepayTransactionsService } from "./sepay-transactions.service"
import { SepayTransactionsAdminReadService } from "./sepay-transactions-admin-read.service"

@Module({})
/** The sepay-transactions capability over the primary PostgreSQL connection. */
export class SepayTransactionsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                SepayTransactionsAdminReadService,
                { provide: INBOX, useClass: InboxService },
                SepayTransactionsService,
                SepayReviewService,
            ],
            exports: [SepayTransactionsAdminReadService, SepayTransactionsService, SepayReviewService],
        }
    }
}
