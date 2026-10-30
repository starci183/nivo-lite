import { QueryHandler } from "@nestjs/cqrs"
import type { DecisionRecord } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DecisionHistoryService } from "./decision-history.service"
import { ListDecisionHistoryQuery } from "./list-decision-history.query"

@QueryHandler(ListDecisionHistoryQuery)
/** Answers the decision log from the three sources that hold it. */
export class ListDecisionHistoryHandler extends ICQRSHandler<ListDecisionHistoryQuery, ReadonlyArray<DecisionRecord>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly history: DecisionHistoryService,
    ) {
        super(logger)
    }

    protected override process(query: ListDecisionHistoryQuery): Promise<ReadonlyArray<DecisionRecord>> {
        return this.history.list(query.params.principal.id, query.params.request.workspaceId, query.params.request)
    }
}
