import { QueryHandler } from "@nestjs/cqrs"
import { LeadActionsService } from "@modules/domain/lead-actions"
import type { LeadActionStatus } from "@modules/domain/lead-actions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadActionStatusQuery } from "./lead-action-status.query"

@QueryHandler(LeadActionStatusQuery)
/** Reads one workspace-scoped lead action through the domain service. */
export class LeadActionStatusHandler extends ICQRSHandler<LeadActionStatusQuery, LeadActionStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly leadActions: LeadActionsService,
    ) {
        super(logger)
    }

    protected override process(query: LeadActionStatusQuery): Promise<LeadActionStatus> {
        return this.leadActions.status(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
