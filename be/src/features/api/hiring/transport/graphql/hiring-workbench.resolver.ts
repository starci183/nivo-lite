import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { HiringWorkbenchQuery } from "../../application/hiring-workbench.query"
import { HiringBenchType } from "./dto/hiring-bench.type"
import { toHiringWorkbenchRequest, toHiringBenchType } from "./hiring-workbench.mapper"

@Resolver()
/** GraphQL door: the whole hiring workbench of the caller's workspace. */
export class HiringWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** The whole hiring workbench of the caller's workspace. */
    @Query(() => HiringBenchType, { name: "hiringWorkbench" })
    async hiringWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<HiringBenchType> {
        const result = await this.queryBus.execute(
            new HiringWorkbenchQuery({ request: toHiringWorkbenchRequest(workspaceId), principal }),
        )
        return toHiringBenchType(result)
    }
}
