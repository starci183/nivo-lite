import { QueryHandler } from "@nestjs/cqrs"
import { DecisionsService } from "@modules/domain/decisions"
import type { DecisionRecord } from "@modules/domain/decisions"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListDecisionHistoryQuery } from "./list-decision-history.query"

@QueryHandler(ListDecisionHistoryQuery)
/** Answers the decision log from the decisions service. */
export class ListDecisionHistoryHandler extends ICQRSHandler<ListDecisionHistoryQuery, ReadonlyArray<DecisionRecord>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly decisions: DecisionsService,
    ) {
        super(logger)
    }

    protected override process(query: ListDecisionHistoryQuery): Promise<ReadonlyArray<DecisionRecord>> {
        return this.decisions.listDecisionHistory(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request,
        )
    }
}
