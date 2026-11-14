import { QueryHandler } from "@nestjs/cqrs"
import { LeadFreezeDoorService } from "@modules/domain/lead-freezes"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ReadLeadFreezeQuery } from "./read-lead-freeze.query"
import type { OptionalLeadFreezeView } from "./lead-freeze.contracts"

@QueryHandler(ReadLeadFreezeQuery)
/** Reads the freeze of a lead or of the customer of a run, for an owner or manager. */
export class ReadLeadFreezeHandler extends ICQRSHandler<ReadLeadFreezeQuery, OptionalLeadFreezeView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly door: LeadFreezeDoorService,
    ) {
        super(logger)
    }

    protected override process(query: ReadLeadFreezeQuery): Promise<OptionalLeadFreezeView> {
        return this.door.readFor(query.params.principal.id, query.params.request)
    }
}
