import { QueryHandler } from "@nestjs/cqrs"
import { LeadJourneyService } from "@modules/domain/lead-views"
import type { LeadJourneyData } from "@modules/domain/lead-views"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadJourneyQuery } from "./lead-journey.query"

@QueryHandler(LeadJourneyQuery)
/** Delegates the authorized customer journey to its owning service. */
export class LeadJourneyHandler extends ICQRSHandler<LeadJourneyQuery, LeadJourneyData> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leads: LeadJourneyService,
    ) {
        super(logger)
    }

    protected override process(query: LeadJourneyQuery): Promise<LeadJourneyData> {
        return this.leads.read(query.params.principal.id, query.params.request.workspaceId, query.params.request.leadId)
    }
}
