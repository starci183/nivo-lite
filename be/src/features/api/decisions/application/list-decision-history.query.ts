import { Query } from "@nestjs/cqrs"
import type { DecisionRecord } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListDecisionHistoryRequest } from "./list-decision-history.contracts"

/** Asks for the newest lines of the decision log of the workspace. */
export class ListDecisionHistoryQuery extends Query<ReadonlyArray<DecisionRecord>> {
    constructor(readonly params: ExecuteParams<ListDecisionHistoryRequest>) {
        super()
    }
}
