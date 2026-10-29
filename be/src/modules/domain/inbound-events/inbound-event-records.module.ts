import { Global, Module } from "@nestjs/common"
import { INBOX, InboxService } from "@modules/platform/inbox"
import { InboundPaymentsReadService } from "./inbound-payments-read.service"
import { InboundEventsService } from "./inbound-events.service"

@Global()
@Module({
    providers: [InboundEventsService, InboundPaymentsReadService, { provide: INBOX, useClass: InboxService }],
    exports: [InboundEventsService, InboundPaymentsReadService],
})
/** The inbound event ledger other capabilities read and write through, registrable on its own by an app that serves no member feed. */
export class InboundEventRecordsModule {}
