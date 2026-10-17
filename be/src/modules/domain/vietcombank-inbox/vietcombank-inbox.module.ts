import { INBOX, InboxService } from "@modules/platform/inbox"
import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./vietcombank-inbox.module-definition"
import { VietcombankReceiptService } from "./vietcombank-inbox.service"

@Module({})
/** The durable inbox of the vietcombank-inbox webhook, over the primary Supabase PostgreSQL connection. */
export class VietcombankInboxModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: INBOX, useClass: InboxService },
                VietcombankReceiptService,
            ],
            exports: [VietcombankReceiptService],
        }
    }
}
