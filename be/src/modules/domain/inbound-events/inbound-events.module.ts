import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbound-events.module-definition"
import { InboundEventsService } from "./inbound-events.service"
import { InboxFeedService } from "./inbox-feed.service"
import { InboundSimulationStoreService } from "./inbound-simulation-store.service"

@Module({})
/** The inbound-events capability over the primary Supabase connection. */
export class InboundEventsModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                InboundEventsService,
                InboxFeedService,
                InboundSimulationStoreService,
                { provide: INBOX, useClass: InboxService },
            ],
            exports: [InboundEventsService, InboxFeedService, InboundSimulationStoreService],
        }
    }
}
