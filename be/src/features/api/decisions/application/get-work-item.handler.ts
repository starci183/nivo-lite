import { QueryHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetWorkItemQuery } from "./get-work-item.query"

@QueryHandler(GetWorkItemQuery)
/** Answers one work item from the decisions service. */
export class GetWorkItemHandler extends ICQRSHandler<GetWorkItemQuery, WorkItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(query: GetWorkItemQuery): Promise<WorkItem> {
        return this.decisions.getWorkItem(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.workItemId,
        )
    }
}
