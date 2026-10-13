import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListDecisionHistoryQuery } from "../../application/list-decision-history.query"
import { DecisionRecordType } from "./dto/decision-record.type"
import { ListDecisionHistoryInput } from "./dto/list-decision-history.input"
import { toDecisionRecordsType, toListDecisionHistoryRequest } from "./decisions.mapper"

@Resolver()
/** GraphQL door of the decision log. */
export class DecisionHistoryResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Lists the newest lines of the decision log, filtered by who decided and by module. */
    @Query(() => [DecisionRecordType], { name: "decisionHistory" })
    async decisionHistory(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListDecisionHistoryInput,
    ): Promise<Array<DecisionRecordType>> {
        const result = await this.queryBus.execute(
            new ListDecisionHistoryQuery({ request: toListDecisionHistoryRequest(workspaceId, input), principal }),
        )
        return toDecisionRecordsType(result)
    }
}
