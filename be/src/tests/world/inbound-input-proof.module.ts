import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { INBOX, InboxService } from "@modules/platform/inbox"

@Module({
    providers: [InboundEventsService, { provide: INBOX, useClass: InboxService }],
    exports: [InboundEventsService],
})
/** The real inbox and input writer over the world's isolated PostgreSQL connection. */
export class InboundInputProofModule {
    /** Composes only the input persistence exercised by these proofs. */
    static register(): DynamicModule {
        return { module: InboundInputProofModule }
    }
}
