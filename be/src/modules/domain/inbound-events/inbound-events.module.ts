import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbound-events.module-definition"
import { InboxFeedService } from "./inbox-feed.service"

@Module({})
/** The inbound-events capability over the primary Supabase connection; the ledger it reads is registered beside it by the app root. */
export class InboundEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), InboxFeedService],
            exports: [InboxFeedService],
        }
    }
}
