import type { QueryBus } from "@nestjs/cqrs"
import { Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadSalesWorkbenchQuery } from "../../application/read-sales-workbench.query"
import { SalesWorkbenchType } from "./dto/sales-workbench.type"
import { toSalesWorkbenchRequest, toSalesWorkbenchType } from "./sales-workbench.mapper"

@Resolver()
/** GraphQL door of the Sales workbench. */
export class SalesWorkbenchResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads the selected workspace's Sales pipeline, decisions, handoffs and activity. */
    @Query(() => SalesWorkbenchType, { name: "salesWorkbench" })
    async salesWorkbench(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<SalesWorkbenchType> {
        const result = await this.queryBus.execute(
            new ReadSalesWorkbenchQuery({ request: toSalesWorkbenchRequest(workspaceId), principal }),
        )
        return toSalesWorkbenchType(result)
    }
}
