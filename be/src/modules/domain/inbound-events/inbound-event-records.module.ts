import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./inbound-event-records.module-definition"
import { InboundPaymentsReadService } from "./inbound-payments-read.service"
import { InboundEventsService } from "./inbound-events.service"

@Module({})
/** The inbound event ledger other capabilities read and write through, registrable on its own by an app that serves no member feed. */
export class InboundEventRecordsModule extends ConfigurableModuleClass {
    /** Registers the ledger once in an app root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                InboundEventsService,
                InboundPaymentsReadService,
                { provide: INBOX, useClass: InboxService },
            ],
            exports: [InboundEventsService, InboundPaymentsReadService],
        }
    }
}
