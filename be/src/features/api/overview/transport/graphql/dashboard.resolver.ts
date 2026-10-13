import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { GetDashboardQuery } from "../../application/get-dashboard.query"
import { toDashboardType } from "./dashboard.mapper"
import { DashboardType } from "./dto/dashboard.type"

@Resolver()
/** GraphQL door of the executive dashboard. */
export class DashboardResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads everything the overview page shows about the active workspace, for any active member. */
    @Query(() => DashboardType, { name: "dashboard" })
    async dashboard(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<DashboardType> {
        const result = await this.queryBus.execute(new GetDashboardQuery({ request: { workspaceId }, principal }))
        return toDashboardType(result)
    }
}
