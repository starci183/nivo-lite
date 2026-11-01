import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InboundEventRecordsModule } from "./inbound-event-records.module"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbound-events.module-definition"
import { InboxFeedService } from "./inbox-feed.service"

@Module({})
/** The inbound-events capability over the primary PostgreSQL connection; it imports and exports the ledger sub-module. */
export class InboundEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [...(base.imports ?? []), InboundEventRecordsModule.register({})],
            providers: [...(base.providers ?? []), InboxFeedService],
            exports: [InboundEventRecordsModule, InboxFeedService],
        }
    }
}
