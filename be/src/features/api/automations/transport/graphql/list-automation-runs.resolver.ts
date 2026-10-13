import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListRunsQuery } from "../../application/list-runs.query"
import { AutomationRunType } from "./dto/automation-run.type"
import { AutomationRunsInput } from "./dto/automation-runs.input"
import { toAutomationRunTypes, toListRunsRequest } from "./list-automation-runs.mapper"

@Resolver()
/** GraphQL door of the run history. */
export class ListAutomationRunsResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the run history of the workspace, or of one template. */
    @Query(() => [AutomationRunType], { name: "automationRuns" })
    async automationRuns(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: AutomationRunsInput,
    ): Promise<Array<AutomationRunType>> {
        const result = await this.queryBus.execute(
            new ListRunsQuery({ request: toListRunsRequest(workspaceId, input), principal }),
        )
        return toAutomationRunTypes(result)
    }
}
