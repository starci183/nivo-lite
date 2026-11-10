import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetWorkspaceDashboardQuery } from "../../application/get-workspace-dashboard.query"
import { WorkspaceDashboardInput } from "./dto/workspace-dashboard.input"
import { WorkspaceDashboardType } from "./dto/workspace-dashboard.type"
import { toWorkspaceDashboardRequest, toWorkspaceDashboardType } from "./workspace-dashboard.mapper"

@Resolver()
/** The GraphQL door for the owner business dashboard. */
export class WorkspaceDashboardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the whole dashboard of the selected workspace for one period, for its owner or a manager. */
    @Query(() => WorkspaceDashboardType, { name: "workspaceDashboard" })
    async workspaceDashboard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: WorkspaceDashboardInput,
    ): Promise<WorkspaceDashboardType> {
        const result = await this.queryBus.execute(
            new GetWorkspaceDashboardQuery({ request: toWorkspaceDashboardRequest(workspaceId, input), principal }),
        )
        return toWorkspaceDashboardType(result)
    }
}
