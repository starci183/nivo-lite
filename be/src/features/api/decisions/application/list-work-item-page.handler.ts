import { QueryHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { WorkItemPage } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListWorkItemPageQuery } from "./list-work-item-page.query"

@QueryHandler(ListWorkItemPageQuery)
/** Answers one page of work items from the decisions service. */
export class ListWorkItemPageHandler extends ICQRSHandler<ListWorkItemPageQuery, WorkItemPage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(query: ListWorkItemPageQuery): Promise<WorkItemPage> {
        return this.decisions.listWorkItems(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request,
        )
    }
}
