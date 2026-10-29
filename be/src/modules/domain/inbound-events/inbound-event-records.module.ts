import { Module } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { ConfigurableModuleClass } from "./inbound-event-records.module-definition"
import { InboundPaymentsReadService } from "./inbound-payments-read.service"
import { InboundEventsService } from "./inbound-events.service"

@Module({
    providers: [InboundEventsService, InboundPaymentsReadService, { provide: INBOX, useClass: InboxService }],
    exports: [InboundEventsService, InboundPaymentsReadService],
})
/** The inbound event ledger other capabilities read and write through, imported and exported by the inbound-events module. */
export class InboundEventRecordsModule extends ConfigurableModuleClass {}
