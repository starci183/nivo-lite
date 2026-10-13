import { QueryHandler } from "@nestjs/cqrs"
import { LeadFlowService } from "@modules/domain/lead-views"
import type { LeadFlowView } from "@modules/domain/lead-views"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFlowQuery } from "./lead-flow.query"

@QueryHandler(LeadFlowQuery)
/** Reads the customer's journey through its domain service. */
export class LeadFlowHandler extends ICQRSHandler<LeadFlowQuery, LeadFlowView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadFlow: LeadFlowService,
    ) {
        super(logger)
    }

    protected override process(query: LeadFlowQuery): Promise<LeadFlowView> {
        return this.leadFlow.read(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.leadId,
        )
    }
}
